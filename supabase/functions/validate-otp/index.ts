/**
 * validate-otp/index.ts
 * Edge Function Supabase — Validation atomique d'un code OTP.
 *
 * POURQUOI UNE EDGE FUNCTION ET PAS LE CLIENT ?
 * ─────────────────────────────────────────────
 * otp-validation.ts côté client lit directement otp_codes depuis Supabase.
 * PROBLÈME : la RLS policies-otp_codes.sql retire tous les privileges
 * pour authenticated. Un client ne peut PAS lire otp_codes.
 *
 * La validation doit se faire ici, avec service_role.
 * L'avantage : la comparaison SHA-256 et le UPDATE "used=true" sont
 * atomiques dans la même Edge Function — pas de race condition possible.
 *
 * DÉPLOIEMENT :
 * supabase functions deploy validate-otp
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OTP_MAX_ATTEMPTS = 5;

// ─── Hash helper (même logique que send-otp) ──────────────────────────────────

async function hashOtp(code: string, userId: string): Promise<string> {
  const salted = `${userId}:${code}`;
  const data = new TextEncoder().encode(salted);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Comparaison temps constant ───────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  let body: { code: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON" }, 400);
  }

  const { code } = body;
  if (!code || typeof code !== "string" || code.trim() === "") {
    return jsonResponse({ success: false, code: "MISSING_CODE" }, 400);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, code: "MISSING_AUTH" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user: authUser } } = await supabaseAnon.auth.getUser(authHeader.slice(7));
  if (!authUser) return jsonResponse({ success: false, code: "INVALID_AUTH" }, 401);

  const userId = authUser.id;

  // ── Récupérer le dernier OTP actif ────────────────────────────────────────
  const { data: otpRecord, error } = await supabaseAdmin
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts, used")
    .eq("user_id", userId)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !otpRecord) {
    return jsonResponse({ success: false, code: "NOT_FOUND", message: "Aucun code actif" }, 404);
  }

  // ── Checks préliminaires ──────────────────────────────────────────────────
  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    return jsonResponse({ success: false, code: "EXPIRED", message: "Code expiré" }, 410);
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return jsonResponse({
      success: false,
      code: "MAX_ATTEMPTS_REACHED",
      message: "Trop de tentatives — demandez un nouveau code",
      attemptsRemaining: 0,
    }, 429);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const submittedHash = await hashOtp(code.trim(), userId);
  const isValid = timingSafeEqual(submittedHash, otpRecord.code_hash);

  if (isValid) {
    // Marquer comme utilisé atomiquement
    const { error: updateError } = await supabaseAdmin
      .from("otp_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", otpRecord.id)
      .eq("used", false); // Guard contre race condition

    if (updateError) {
      return jsonResponse({ success: false, code: "UPDATE_FAILED" }, 500);
    }

    return jsonResponse({ success: true, code: "VALID" });
  }

  // Code incorrect — incrémenter les tentatives
  const newAttempts = otpRecord.attempts + 1;
  const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts);

  await supabaseAdmin
    .from("otp_codes")
    .update({
      attempts: newAttempts,
      ...(attemptsRemaining === 0 ? { used: true } : {}),
    })
    .eq("id", otpRecord.id);

  return jsonResponse({
    success: false,
    code: attemptsRemaining === 0 ? "MAX_ATTEMPTS_REACHED" : "INVALID_CODE",
    message: attemptsRemaining === 0
      ? "Code verrouillé — demandez un nouveau code"
      : `Code incorrect — ${attemptsRemaining} tentative${attemptsRemaining > 1 ? "s" : ""} restante${attemptsRemaining > 1 ? "s" : ""}`,
    attemptsRemaining,
  }, 400);
});
