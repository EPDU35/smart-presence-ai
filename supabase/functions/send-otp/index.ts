/**
 * send-otp/index.ts
 * Edge Function Supabase — Envoi sécurisé de codes OTP.
 *
 * POURQUOI UNE EDGE FUNCTION ?
 * ────────────────────────────
 * 1. Les clés SMTP / Twilio ne doivent JAMAIS être dans le bundle JS frontend.
 * 2. Le rate-limit (1 OTP/60s) doit être appliqué côté serveur — pas bypassable.
 * 3. La génération du code se fait ici — le client ne voit jamais le code brut.
 * 4. Le hash SHA-256 + salt est calculé ici avec WebCrypto (Deno).
 *
 * FLOW :
 * 1. Vérifier JWT
 * 2. Récupérer le profil user (2FA configuré ?)
 * 3. Rate-limit : max 1 OTP par 60s par user
 * 4. Générer le code OTP (6 chiffres, crypto.getRandomValues)
 * 5. Hasher le code (SHA-256 + salt = userId)
 * 6. Invalider les anciens OTP de cet user
 * 7. Insérer le nouveau OTP hashé en base
 * 8. Envoyer le code brut par email ou SMS
 * 9. Retourner la destination masquée (jamais le code)
 *
 * DÉPLOIEMENT :
 * supabase functions deploy send-otp
 *
 * VARIABLES D'ENVIRONNEMENT REQUISES (Supabase Secrets) :
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_ANON_KEY
 * - RESEND_API_KEY          (pour les emails)
 * - TWILIO_ACCOUNT_SID      (pour les SMS)
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 * - APP_NAME                (ex: "Smart Presence AI")
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

type OtpChannel = "EMAIL" | "SMS";
type OtpFlow = "LOGIN" | "SETUP_2FA" | "VERIFY";

interface SendOtpRequest {
  channel: OtpChannel;
  flow?: OtpFlow;
  userId?: string;        // Pour le flow LOGIN (user partiellement auth)
}

interface SendOtpResponse {
  success: boolean;
  maskedDestination?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
  error?: string;
  code?: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OTP_TTL_MS       = 10 * 60 * 1000;   // 10 minutes
const OTP_LENGTH       = 6;
const OTP_RATE_LIMIT_S = 60;               // 1 OTP max par minute
const OTP_MAX_ATTEMPTS = 5;

// ─── Crypto helpers ──────────────────────────────────────────────────────────

/** Génère un code OTP numérique cryptographiquement sécurisé. */
function generateOtpCode(length = OTP_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b % 10).join("");
}

/** Hash SHA-256 du code avec userId comme salt. */
async function hashOtp(code: string, userId: string): Promise<string> {
  const salted = `${userId}:${code}`;
  const data = new TextEncoder().encode(salted);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Masquage ─────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  return `${phone.slice(0, 4)} ** ** ** ${phone.slice(-2)}`;
}

// ─── Envoi email via Resend ───────────────────────────────────────────────────

async function sendEmailOtp(
  toEmail: string,
  code: string,
  appName: string
): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY non configurée");

  const html = `
    <div style="font-family: 'Sora', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
      <div style="background: #2563EB; width: 48px; height: 48px; border-radius: 12px;
                  display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
        <span style="color: white; font-size: 20px; font-weight: 700;">SP</span>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; text-align: center; margin: 0 0 8px;">
        Code de vérification
      </h1>
      <p style="font-size: 14px; color: #64748B; text-align: center; margin: 0 0 32px;">
        ${appName} — Authentification à deux facteurs
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;
                  padding: 24px; text-align: center; margin: 0 0 24px;">
        <p style="font-size: 13px; color: #64748B; margin: 0 0 8px;">Votre code de connexion</p>
        <p style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #2563EB;
                  font-family: 'Courier New', monospace; margin: 0;">
          ${code}
        </p>
        <p style="font-size: 12px; color: #94A3B8; margin: 12px 0 0;">
          Valide pendant 10 minutes — usage unique
        </p>
      </div>
      <p style="font-size: 13px; color: #94A3B8; text-align: center; line-height: 1.6;">
        Si vous n'avez pas demandé ce code, ignorez cet email.<br>
        Ne communiquez jamais ce code à personne.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${appName} <noreply@smartpresence.ai>`,
      to: [toEmail],
      subject: `${code} — Code de vérification ${appName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error: ${res.status} — ${errBody}`);
  }
}

// ─── Envoi SMS via Twilio ─────────────────────────────────────────────────────

async function sendSmsOtp(
  toPhone: string,
  code: string,
  appName: string
): Promise<void> {
  const sid   = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from  = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!sid || !token || !from) throw new Error("Variables Twilio non configurées");

  const message = `${appName} — Votre code : ${code}. Valide 10 min. Ne le communiquez pas.`;
  const params  = new URLSearchParams({ To: toPhone, From: from, Body: message });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Twilio error: ${res.status} — ${errBody}`);
  }
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function jsonResponse(body: SendOtpResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", error: "POST only" }, 405);
  }

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: SendOtpRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON", error: "Corps invalide" }, 400);
  }

  const { channel, flow = "VERIFY" } = body;

  if (!["EMAIL", "SMS"].includes(channel)) {
    return jsonResponse({ success: false, code: "INVALID_CHANNEL", error: "Canal invalide" }, 400);
  }

  // ── 2. Client Supabase service_role ───────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 3. Vérifier l'authentification ───────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, code: "MISSING_AUTH", error: "Auth requise" }, 401);
  }

  const jwt = authHeader.slice(7);
  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user: authUser }, error: authError } = await supabaseAnon.auth.getUser(jwt);
  if (authError || !authUser) {
    return jsonResponse({ success: false, code: "INVALID_AUTH", error: "Session invalide" }, 401);
  }

  const userId = authUser.id;

  // ── 4. Récupérer le profil user ───────────────────────────────────────────
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, two_fa_enabled, two_fa_channel")
    .eq("id", userId)
    .single();

  if (profileError || !userProfile) {
    return jsonResponse({ success: false, code: "USER_NOT_FOUND", error: "Profil introuvable" }, 404);
  }

  // ── 5. Récupérer email/phone depuis auth.users ────────────────────────────
  const { data: { user: fullUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!fullUser) {
    return jsonResponse({ success: false, code: "AUTH_USER_NOT_FOUND", error: "Utilisateur Auth introuvable" }, 404);
  }

  const userEmail = fullUser.email;
  const userPhone = fullUser.phone;

  // Vérifier que la destination existe selon le canal
  if (channel === "EMAIL" && !userEmail) {
    return jsonResponse({ success: false, code: "NO_EMAIL", error: "Aucune adresse email configurée" }, 400);
  }
  if (channel === "SMS" && !userPhone) {
    return jsonResponse({ success: false, code: "NO_PHONE", error: "Aucun numéro de téléphone configuré" }, 400);
  }

  // ── 6. Rate-limit : max 1 OTP par 60 secondes ────────────────────────────
  const since = new Date(Date.now() - OTP_RATE_LIMIT_S * 1000).toISOString();

  const { data: recentOtps } = await supabaseAdmin
    .from("otp_codes")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (recentOtps && recentOtps.length > 0) {
    const lastCreated = new Date(recentOtps[0].created_at).getTime();
    const retryAfterMs = OTP_RATE_LIMIT_S * 1000 - (Date.now() - lastCreated);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return jsonResponse({
      success: false,
      code: "RATE_LIMITED",
      error: `Trop de demandes — réessayez dans ${retryAfterSeconds}s`,
      retryAfterSeconds,
    }, 429);
  }

  // ── 7. Générer le code OTP ────────────────────────────────────────────────
  const code      = generateOtpCode();
  const codeHash  = await hashOtp(code, userId);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // ── 8. Invalider les anciens OTPs actifs ──────────────────────────────────
  await supabaseAdmin
    .from("otp_codes")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("used", false);

  // ── 9. Insérer le nouveau OTP hashé ──────────────────────────────────────
  const { error: insertError } = await supabaseAdmin
    .from("otp_codes")
    .insert({
      user_id:   userId,
      code_hash: codeHash,
      channel,
      expires_at: expiresAt,
      attempts:  0,
      used:      false,
    });

  if (insertError) {
    return jsonResponse({ success: false, code: "OTP_INSERT_FAILED", error: "Erreur création OTP" }, 500);
  }

  // ── 10. Envoyer le code ───────────────────────────────────────────────────
  const appName = Deno.env.get("APP_NAME") ?? "Smart Presence";

  try {
    if (channel === "EMAIL") {
      await sendEmailOtp(userEmail!, code, appName);
    } else {
      await sendSmsOtp(userPhone!, code, appName);
    }
  } catch (sendError) {
    console.error("[send-otp] Send error:", sendError);

    // Si l'envoi échoue, invalider l'OTP créé pour éviter un OTP "orphelin"
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("used", false);

    return jsonResponse({
      success: false,
      code: "SEND_FAILED",
      error: "Échec de l'envoi — vérifiez votre email/téléphone",
    }, 500);
  }

  // ── 11. Réponse — destination masquée, jamais le code ────────────────────
  const maskedDestination =
    channel === "EMAIL"
      ? maskEmail(userEmail!)
      : maskPhone(userPhone!);

  return jsonResponse({
    success: true,
    maskedDestination,
    expiresAt,
  });
});
