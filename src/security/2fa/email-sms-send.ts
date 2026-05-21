/**
 * email-sms-send.ts
 * Envoi des codes OTP par email ou SMS via Edge Function.
 *
 * AVOCAT DU DIABLE :
 * On N'envoie PAS les emails/SMS directement depuis le frontend.
 * Raisons :
 * 1. Les clés SMTP/Twilio dans le frontend = exposées dans le bundle JS.
 * 2. Un user malveillant peut spammer n'importe quelle adresse.
 * 3. Rate-limiting impossible côté client.
 *
 * Tout passe par une Edge Function qui :
 * - Vérifie que l'user est authentifié
 * - Applique le rate-limit (1 OTP/minute)
 * - Génère le code côté serveur (jamais côté client)
 * - Envoie via le provider configuré (Resend pour email, Twilio pour SMS)
 *
 * Ce fichier est le client qui appelle la Edge Function.
 * Il NE contient pas de clé API. Jamais.
 */

import { supabase } from "@/lib/supabase";
import { refreshIfNeeded } from "@/security/auth/refresh-tokens";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OtpChannel = "EMAIL" | "SMS";

export interface SendOtpResult {
  success: boolean;
  channel?: OtpChannel;
  maskedDestination?: string;   // "j***@gmail.com" ou "+225 ** ** ** 89"
  expiresAt?: string;
  error?: string;
  retryAfterSeconds?: number;   // Si rate-limited
}

// ─── Masquage des destinations ────────────────────────────────────────────────

/**
 * Masque une adresse email pour l'afficher à l'utilisateur.
 * "jean.dupont@gmail.com" → "je***@gmail.com"
 *
 * Pourquoi : confirmation visuelle sans exposer l'adresse complète
 * (utile si l'écran est visible par quelqu'un d'autre).
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Masque un numéro de téléphone.
 * "+22507123456" → "+225 ** ** ** 56"
 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  const last2 = phone.slice(-2);
  const prefix = phone.slice(0, Math.min(4, phone.length));
  return `${prefix} ** ** ** ${last2}`;
}

// ─── Envoi OTP ────────────────────────────────────────────────────────────────

/**
 * Demande l'envoi d'un OTP via la Edge Function `send-otp`.
 * Le code est généré et envoyé côté serveur — jamais exposé au client.
 */
export async function requestOtpSend(channel: OtpChannel): Promise<SendOtpResult> {
  // S'assurer que le token est frais avant l'appel Edge Function
  const { token } = await refreshIfNeeded();
  if (!token) {
    return { success: false, error: "NOT_AUTHENTICATED" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { channel },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      // Supabase retourne l'erreur HTTP dans error.message
      const parsed = tryParseError(error.message);
      return {
        success: false,
        error: parsed.code ?? "SEND_FAILED",
        retryAfterSeconds: parsed.retryAfterSeconds,
      };
    }

    return {
      success: true,
      channel,
      maskedDestination: data?.maskedDestination,
      expiresAt: data?.expiresAt,
    };
  } catch (err) {
    console.error("[OTP] Send error:", err);
    return { success: false, error: "NETWORK_ERROR" };
  }
}

/**
 * Re-envoie un OTP (flow "Je n'ai pas reçu le code").
 * La Edge Function applique le même rate-limit.
 */
export async function resendOtp(channel: OtpChannel): Promise<SendOtpResult> {
  // Même flow que requestOtpSend — la Edge Function invalide l'ancien OTP
  return requestOtpSend(channel);
}

/**
 * Envoie l'OTP de login (appelé après vérification du mot de passe,
 * si la 2FA est activée pour cet utilisateur).
 */
export async function sendLoginOtp(
  userId: string,
  channel: OtpChannel
): Promise<SendOtpResult> {
  // À ce stade, l'utilisateur est partiellement authentifié (password OK, 2FA pending).
  // La Edge Function vérifie que le userId correspond à la session en cours.
  try {
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { channel, flow: "LOGIN", userId },
    });

    if (error) {
      const parsed = tryParseError(error.message);
      return {
        success: false,
        error: parsed.code ?? "SEND_FAILED",
        retryAfterSeconds: parsed.retryAfterSeconds,
      };
    }

    return {
      success: true,
      channel,
      maskedDestination: data?.maskedDestination,
      expiresAt: data?.expiresAt,
    };
  } catch {
    return { success: false, error: "NETWORK_ERROR" };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tente de parser une erreur JSON retournée par la Edge Function.
 * Format attendu : { code: string, retryAfterSeconds?: number }
 */
function tryParseError(message: string): {
  code?: string;
  retryAfterSeconds?: number;
} {
  try {
    return JSON.parse(message);
  } catch {
    return { code: message };
  }
}

/**
 * Retourne le canal 2FA configuré pour un utilisateur,
 * ou null si la 2FA est désactivée.
 */
export async function getUserOtpChannel(
  userId: string
): Promise<OtpChannel | null> {
  const { data } = await supabase
    .from("users")
    .select("two_fa_enabled, two_fa_channel")
    .eq("id", userId)
    .single();

  if (!data?.two_fa_enabled) return null;
  return (data.two_fa_channel as OtpChannel) ?? null;
}
