# Smart Presence AI — Guide de déploiement Sécurité

## FICHIERS À REMPLACER DANS TON PROJET

```
src/hooks/useAuth.ts                     → remplace l'existant
src/hooks/useCheckin.ts                  → remplace l'existant
src/security/auth/protected-routes.tsx   → remplace l'existant
src/security/qr/anti-fraude-checks.ts    → remplace l'existant
src/security/device/device-trust-logic.ts → remplace l'existant
src/security/rls/policies-suspicious_logs.sql → NOUVEAU
src/security/rls/policies-otp_codes.sql       → NOUVEAU
src/routes/index.tsx                     → remplace l'existant
```

## EDGE FUNCTIONS À DÉPLOYER

```
supabase/functions/validate-checkin/index.ts  → NOUVELLE
supabase/functions/send-otp/index.ts          → NOUVELLE
supabase/functions/validate-otp/index.ts      → NOUVELLE
```

---

## DÉPLOIEMENT DES EDGE FUNCTIONS

### 1. Installer Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref uzfvzwiwfwitecjugiuk
```

### 2. Déployer les fonctions

```bash
supabase functions deploy validate-checkin
supabase functions deploy send-otp
supabase functions deploy validate-otp
```

### 3. Configurer les secrets (variables d'environnement)

```bash
# Obligatoires pour validate-checkin et validate-otp
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key
supabase secrets set APP_NAME="Smart Presence AI"

# Pour send-otp — email via Resend
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx

# Pour send-otp — SMS via Twilio (optionnel si SMS non utilisé)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxx
supabase secrets set TWILIO_PHONE_NUMBER=+12025551234
```

**Les clés SUPABASE_URL et SUPABASE_ANON_KEY sont injectées automatiquement.**

---

## EXÉCUTER LES POLICIES RLS

Dans Supabase → SQL Editor, exécuter dans cet ordre :

```
1. supabase-schema.sql (si pas encore fait)
2. policies-suspicious_logs.sql
3. policies-otp_codes.sql
```

---

## TESTER LES EDGE FUNCTIONS

### validate-checkin

```bash
curl -X POST https://uzfvzwiwfwitecjugiuk.supabase.co/functions/v1/validate-checkin \
  -H "Authorization: Bearer TON_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "UN_TOKEN_QR_VALIDE",
    "latitude": 5.345,
    "longitude": -4.021,
    "accuracy": 15
  }'
```

Réponse attendue :
```json
{
  "success": true,
  "status": "PRESENT",
  "checkinId": "uuid...",
  "distanceMeters": 42,
  "message": "Présence enregistrée"
}
```

### send-otp

```bash
curl -X POST https://uzfvzwiwfwitecjugiuk.supabase.co/functions/v1/send-otp \
  -H "Authorization: Bearer TON_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "channel": "EMAIL" }'
```

### validate-otp

```bash
curl -X POST https://uzfvzwiwfwitecjugiuk.supabase.co/functions/v1/validate-otp \
  -H "Authorization: Bearer TON_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "code": "123456" }'
```

---

## RÉSUMÉ SÉCURITÉ — CE QUI EST PROTÉGÉ

| Attaque | Protection |
|---------|-----------|
| INSERT checkin direct (sans QR) | Edge Function validate-checkin obligatoire |
| Réutilisation token QR | used_at + active=false atomique |
| GPS falsifié | haversine + fake GPS detection + radius check |
| Brute force OTP | rate-limit 1/60s + max 5 tentatives + lock |
| Replay OTP | used=true après validation, jamais réutilisable |
| Cross-company data | RLS company_id isolation sur toutes les tables |
| Session expirée active | onAuthStateChange + visibility refresh check |
| Appareil inconnu | device fingerprint + NEW_DEVICE alert |
| Lecture otp_codes | REVOKE ALL pour authenticated |
| Employee lit suspicious_logs | Deny by default, ADMIN only |
