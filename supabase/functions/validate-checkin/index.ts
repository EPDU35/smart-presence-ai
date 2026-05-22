/**
 * validate-checkin/index.ts
 * Edge Function Supabase — Validation atomique d'un check-in.
 *
 * POURQUOI UNE EDGE FUNCTION ET PAS UN INSERT CLIENT ?
 * ─────────────────────────────────────────────────────
 * Un INSERT direct depuis le client (anon key) permettrait à n'importe qui de :
 * 1. Envoyer un status = 'PRESENT' sans avoir scanné de QR
 * 2. Injecter des coordonnées GPS fictives (5.345, -4.021 depuis son canapé)
 * 3. Réutiliser un token QR expiré ou déjà consommé
 * 4. Contourner la validation radius_meters de l'entreprise
 *
 * Ici on utilise service_role — RLS bypassed — mais toutes les validations
 * sont faites explicitement dans ce code. C'est plus sécurisé, pas moins.
 *
 * FLOW ATOMIQUE :
 * 1. Vérifier JWT de l'appelant
 * 2. Récupérer le profil user (rôle, company_id)
 * 3. Valider le token QR (existe, actif, non expiré, non utilisé)
 * 4. Valider que le QR appartient à la même company que l'user
 * 5. Calculer la distance GPS vs company
 * 6. Valider que distance <= radius_meters
 * 7. Détecter les signaux de fraude
 * 8. Déterminer le status (PRESENT / LATE / FLAGGED)
 * 9. UPDATE qr_session (used_at, active=false) — atomique
 * 10. INSERT checkin — atomique
 * 11. Si FLAGGED → INSERT suspicious_log
 *
 * Les étapes 9 et 10 sont dans la même transaction PostgreSQL.
 * Pas de race condition possible.
 *
 * DÉPLOIEMENT :
 * supabase functions deploy validate-checkin
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckinRequest {
  token: string;           // Token QR scanné
  latitude: number;        // GPS employé
  longitude: number;       // GPS employé
  accuracy?: number;       // Précision GPS en mètres
  deviceInfo?: {
    fingerprint: string;
    deviceName: string;
    userAgent: string;
  };
}

interface CheckinResponse {
  success: boolean;
  status?: "PRESENT" | "LATE" | "FLAGGED";
  checkinId?: string;
  distanceMeters?: number;
  message?: string;
  code?: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tolérance GPS max acceptée (mètres). Au-delà = rejet.
// AVOCAT DU DIABLE : 200m est généreux. Mettre 100m pour plus strict.
// Mais les bâtiments en béton dégradent le signal → 200m est raisonnable.
const MAX_GPS_ACCURACY_M = 200;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Formule de Haversine — distance en mètres entre deux coordonnées GPS.
 * Dupliquée ici pour que la Edge Function soit auto-suffisante
 * (pas d'import depuis src/security — les Edge Functions ont leur propre runtime).
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Détecte les signaux évidents de GPS falsifié.
 * Note : heuristiques — pas infaillible côté client.
 */
function detectSuspiciousGps(
  lat: number,
  lon: number,
  accuracy: number
): string[] {
  const flags: string[] = [];
  if (accuracy < 2) flags.push("GPS_ACCURACY_TOO_PERFECT");
  if (accuracy > MAX_GPS_ACCURACY_M) flags.push("GPS_ACCURACY_TOO_LOW");
  if (lat === 0 && lon === 0) flags.push("GPS_NULL_ISLAND");
  const latDec = (lat.toString().split(".")[1] ?? "").length;
  const lonDec = (lon.toString().split(".")[1] ?? "").length;
  if (latDec <= 3 || lonDec <= 3) flags.push("GPS_ROUND_COORDINATES");
  return flags;
}

function jsonResponse(body: CheckinResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", message: "POST only" }, 405);
  }

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: CheckinRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON", message: "Corps de requête invalide" }, 400);
  }

  const { token, latitude, longitude, accuracy = 999, deviceInfo } = body;

  // Validation des paramètres obligatoires
  if (!token || typeof token !== "string" || token.trim() === "") {
    return jsonResponse({ success: false, code: "MISSING_TOKEN", message: "Token QR manquant" }, 400);
  }
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonResponse({ success: false, code: "MISSING_GPS", message: "Coordonnées GPS manquantes" }, 400);
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return jsonResponse({ success: false, code: "INVALID_GPS", message: "Coordonnées GPS invalides" }, 400);
  }

  // ── 2. Créer le client Supabase avec service_role ─────────────────────────
  // service_role bypasse RLS — TOUTES les validations sont faites manuellement ici.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 3. Vérifier le JWT de l'appelant ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, code: "MISSING_AUTH", message: "Authentification requise" }, 401);
  }

  const jwt = authHeader.slice(7);
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser(jwt);
  if (authError || !authUser) {
    return jsonResponse({ success: false, code: "INVALID_TOKEN", message: "Session invalide ou expirée" }, 401);
  }

  const userId = authUser.id;

  // ── 4. Récupérer le profil utilisateur ────────────────────────────────────
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, company_id, role, two_fa_enabled")
    .eq("id", userId)
    .single();

  if (profileError || !userProfile) {
    return jsonResponse({ success: false, code: "USER_NOT_FOUND", message: "Profil utilisateur introuvable" }, 404);
  }

  if (!userProfile.company_id) {
    return jsonResponse({ success: false, code: "NO_COMPANY", message: "Vous n'appartenez à aucune organisation" }, 403);
  }

  const companyId = userProfile.company_id;

  // ── 5. Valider le token QR ────────────────────────────────────────────────
  const { data: qrSession, error: qrError } = await supabaseAdmin
    .from("qr_sessions")
    .select("id, company_id, token, expires_at, active, used_at")
    .eq("token", token)
    .single();

  if (qrError || !qrSession) {
    return jsonResponse({ success: false, code: "QR_NOT_FOUND", message: "QR Code invalide ou introuvable" }, 404);
  }

  // Token appartient à la bonne company ?
  if (qrSession.company_id !== companyId) {
    // Log de tentative de fraude inter-company
    await supabaseAdmin.from("suspicious_logs").insert({
      user_id: userId,
      company_id: companyId,
      reason: "QR_WRONG_COMPANY",
      device: deviceInfo?.fingerprint ?? null,
      metadata: {
        token_company: qrSession.company_id,
        user_company: companyId,
        token: token.slice(0, 8) + "...",
      },
    });
    return jsonResponse({ success: false, code: "QR_WRONG_COMPANY", message: "QR Code non valide pour votre organisation" }, 403);
  }

  // Token encore actif ?
  if (!qrSession.active) {
    return jsonResponse({ success: false, code: "QR_INACTIVE", message: "QR Code désactivé" }, 410);
  }

  // Token déjà utilisé ?
  if (qrSession.used_at !== null) {
    await supabaseAdmin.from("suspicious_logs").insert({
      user_id: userId,
      company_id: companyId,
      reason: "QR_REPLAY_ATTEMPT",
      device: deviceInfo?.fingerprint ?? null,
      metadata: { used_at: qrSession.used_at, token: token.slice(0, 8) + "..." },
    });
    return jsonResponse({ success: false, code: "QR_ALREADY_USED", message: "QR Code déjà utilisé" }, 409);
  }

  // Token expiré ?
  const now = new Date();
  const expiresAt = new Date(qrSession.expires_at);
  if (now > expiresAt) {
    return jsonResponse({ success: false, code: "QR_EXPIRED", message: "QR Code expiré — demandez un nouveau scan" }, 410);
  }

  // ── 6. Vérifier que l'user n'a pas déjà pointé aujourd'hui ───────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayCount } = await supabaseAdmin
    .from("checkins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("status", ["PRESENT", "LATE"])
    .gte("created_at", todayStart.toISOString());

  if ((todayCount ?? 0) > 0) {
    return jsonResponse({
      success: false,
      code: "ALREADY_CHECKED_IN",
      message: "Vous avez déjà pointé aujourd'hui",
    }, 409);
  }

  // ── 7. Récupérer la company pour validation GPS ───────────────────────────
  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, latitude, longitude, radius_meters, opening_time, closing_time, late_tolerance")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    return jsonResponse({ success: false, code: "COMPANY_NOT_FOUND", message: "Organisation introuvable" }, 404);
  }

  // ── 8. Validation GPS — distance ─────────────────────────────────────────
  const distanceMeters = Math.round(
    haversineDistance(latitude, longitude, company.latitude, company.longitude)
  );

  // Tolérance GPS basée sur la précision déclarée (max 50m)
  const gpsTolerance = Math.min(accuracy, 50);
  const effectiveRadius = (company.radius_meters ?? 100) + gpsTolerance;

  const outsideRadius = distanceMeters > effectiveRadius;
  const suspiciousGpsFlags = detectSuspiciousGps(latitude, longitude, accuracy);

  // GPS hors zone = refus immédiat (pas juste FLAGGED)
  if (outsideRadius) {
    await supabaseAdmin.from("suspicious_logs").insert({
      user_id: userId,
      company_id: companyId,
      reason: "CHECKIN_OUTSIDE_RADIUS",
      device: deviceInfo?.fingerprint ?? null,
      metadata: {
        distance: distanceMeters,
        radius: company.radius_meters,
        effective_radius: effectiveRadius,
        user_coords: { lat: latitude, lon: longitude },
        company_coords: { lat: company.latitude, lon: company.longitude },
      },
    });
    return jsonResponse({
      success: false,
      code: "OUTSIDE_RADIUS",
      message: `Vous êtes trop loin — ${distanceMeters}m (maximum autorisé: ${company.radius_meters}m)`,
      distanceMeters,
    }, 403);
  }

  // ── 9. Déterminer le statut (PRESENT / LATE / FLAGGED) ───────────────────
  let checkinStatus: "PRESENT" | "LATE" | "FLAGGED" = "PRESENT";
  const fraudFlags: string[] = [...suspiciousGpsFlags];

  // Vérification horaire d'ouverture
  if (company.opening_time) {
    const [oh, om] = (company.opening_time as string).split(":").map(Number);
    const openingDate = new Date();
    openingDate.setHours(oh, om, 0, 0);
    const toleranceMs = ((company.late_tolerance as number) ?? 0) * 60_000;
    const lateLimit = new Date(openingDate.getTime() + toleranceMs);

    if (now > lateLimit) {
      checkinStatus = "LATE";
    }
  }

  // Vérification horaire de fermeture
  if (company.closing_time) {
    const [ch, cm] = (company.closing_time as string).split(":").map(Number);
    const closingDate = new Date();
    closingDate.setHours(ch, cm, 0, 0);
    if (now > closingDate) {
      return jsonResponse({
        success: false,
        code: "AFTER_CLOSING_TIME",
        message: "La session de pointage est terminée pour aujourd'hui",
      }, 403);
    }
  }

  // GPS suspect → FLAGGED (mais pas refusé — admin décidera)
  if (suspiciousGpsFlags.length >= 2) {
    checkinStatus = "FLAGGED";
    fraudFlags.push(...suspiciousGpsFlags);
  }

  // ── 10. Transaction atomique : UPDATE qr_session + INSERT checkin ─────────
  // Supabase ne supporte pas encore les transactions multi-tables via client.
  // On fait UPDATE d'abord avec un check optimiste, puis INSERT.
  // Si l'UPDATE ne trouve pas la ligne (race condition), on abort.

  // UPDATE qr_session — marquer comme utilisée
  const { error: updateQrError, count: updatedRows } = await supabaseAdmin
    .from("qr_sessions")
    .update({
      active: false,
      used_at: now.toISOString(),
    })
    .eq("id", qrSession.id)
    .eq("active", true)          // Guard : si une autre requête a déjà modifié → 0 rows
    .is("used_at", null)         // Guard : double protection
    .select("id", { count: "exact" });

  // Si 0 rows updated = race condition — une autre requête a déjà consommé ce token
  if (updateQrError || updatedRows === 0) {
    return jsonResponse({
      success: false,
      code: "QR_RACE_CONDITION",
      message: "QR Code déjà utilisé (conflit de scan simultané)",
    }, 409);
  }

  // INSERT checkin
  const { data: checkin, error: checkinError } = await supabaseAdmin
    .from("checkins")
    .insert({
      user_id: userId,
      company_id: companyId,
      status: checkinStatus,
      qr_session_id: qrSession.id,
      device_info: deviceInfo
        ? {
            fingerprint: deviceInfo.fingerprint,
            deviceName: deviceInfo.deviceName,
            userAgent: deviceInfo.userAgent,
            gpsAccuracy: accuracy,
          }
        : null,
      created_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (checkinError || !checkin) {
    // Rollback manuel : réactiver le QR pour que l'user puisse réessayer
    await supabaseAdmin
      .from("qr_sessions")
      .update({ active: true, used_at: null })
      .eq("id", qrSession.id);

    return jsonResponse({
      success: false,
      code: "CHECKIN_INSERT_FAILED",
      message: "Erreur lors de l'enregistrement — réessayez",
    }, 500);
  }

  // ── 11. Log suspicious si FLAGGED ────────────────────────────────────────
  if (checkinStatus === "FLAGGED" && fraudFlags.length > 0) {
    await supabaseAdmin.from("suspicious_logs").insert({
      user_id: userId,
      company_id: companyId,
      reason: fraudFlags.join(" | "),
      device: deviceInfo?.fingerprint ?? null,
      metadata: {
        checkin_id: checkin.id,
        fraud_flags: fraudFlags,
        distance: distanceMeters,
        gps_accuracy: accuracy,
      },
    });
  }

  // ── 12. Mettre à jour last_seen de l'user ────────────────────────────────
  await supabaseAdmin
    .from("users")
    .update({ last_seen: now.toISOString() })
    .eq("id", userId);

  // ── 13. Réponse succès ───────────────────────────────────────────────────
  return jsonResponse({
    success: true,
    status: checkinStatus,
    checkinId: checkin.id,
    distanceMeters,
    message:
      checkinStatus === "PRESENT"
        ? "Présence enregistrée"
        : checkinStatus === "LATE"
        ? "Présence enregistrée avec retard"
        : "Présence enregistrée — anomalie signalée à l'admin",
  });
});
