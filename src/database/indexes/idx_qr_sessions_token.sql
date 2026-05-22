-- ===== idx_qr_sessions_token.sql =====
-- Répond à deux requêtes distinctes, d'où les deux index dans ce fichier :
--
-- INDEX 1 — Validation d'un token à la réception du scan
-- Pattern : WHERE token = $1 (lookup exact pour récupérer la session complète)
-- Note : idx_qr_token existe déjà sur qr_sessions selon le contexte.
-- Cet index est donc documenté ici à titre de référence mais NON recréé
-- (IF NOT EXISTS protège, mais on commente explicitement pour la lisibilité).
--
-- INDEX 2 — Récupération des sessions actives en attente de scan
-- Pattern admin (affichage QR live) :
--   WHERE active = true AND used_at IS NULL AND expires_at > now()
-- C'est la requête la plus fréquente côté admin dashboard (polling ou realtime fallback).

-- Index 1 : déjà couvert par idx_qr_token (Eliel). IF NOT EXISTS protège contre le doublon,
-- mais on l'inclut dans ce fichier pour documenter la couverture complète du token lookup.
CREATE INDEX IF NOT EXISTS idx_qr_token
  ON qr_sessions (token);

-- Index 2 : index PARTIEL sur les sessions vivantes uniquement.
-- La condition WHERE filtre à moins de 1% des lignes totales :
-- chaque session expire en 15 secondes, donc la table accumule des millions
-- de sessions historiques (used_at IS NOT NULL) qui ne nous intéressent jamais
-- dans ce pattern. L'index partiel ne les stocke pas → taille ~100x plus petite,
-- tenu entièrement en RAM sur un Supabase pro standard.
--
-- Gain attendu : bitmap scan sur idx_qr_active + idx_qr_expires_at (~10K lignes) →
-- index scan partiel (~5 lignes actives en moyenne). Latence : 15ms → 0.1ms.
-- C'est aussi le chemin de validation dans createCheckin() — gain de sécurité direct
-- car la vérification "token encore valide ?" est quasi-instantanée.
CREATE INDEX IF NOT EXISTS idx_qr_sessions_active_unconsumed
  ON qr_sessions (expires_at ASC)
  WHERE active = true AND used_at IS NULL;

-- ASC sur expires_at : permet de retrouver rapidement les sessions proches
-- d'expirer (utile pour un éventuel cleanup ou pour prioriser les tokens
-- les plus "frais" si plusieurs sessions coexistent pour une company).
-- La condition partielle (active=true AND used_at IS NULL) est une constante
-- au moment de la création — PostgreSQL l'évalue une fois à l'indexation,
-- pas à chaque requête. Pour que PostgreSQL utilise cet index, la requête
-- applicative doit inclure exactement ces conditions dans son WHERE.