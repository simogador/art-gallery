---
title: 'Story 1.9 — Contacts de la page de maintenance enregistrés'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le formulaire « Me notifier » de `public/maintenance.html` n'enregistre rien (il affiche un faux succès et écrit l'e-mail dans la console du navigateur) : les visiteurs arrivés pendant la maintenance sont perdus (FR-35).

**Approach:** Le module `demandes` enregistre l'e-mail et la date du consentement (table créée par cette story, avec sa migration) quand le formulaire est envoyé avec un e-mail valide et la case de consentement cochée, et la page affiche un accusé. Sans consentement ou avec un e-mail invalide, rien n'est enregistré, le message dit ce qui manque et la saisie est conservée. Les envois répétés par IP ou par e-mail au-delà d'un seuil sont refusés sans erreur technique visible ; un e-mail déjà inscrit ne crée pas de doublon. L'administration affiche le nombre d'inscrits et permet d'exporter la liste. Aucun e-mail dans les journaux. Ne touche ni `MAINTENANCE_MODE`, ni `robots.txt`, ni `src/generated/prisma/`, ni aucun secret.

</frozen-after-approval>

## Implementation Notes

- Schéma : `InscriptionOuverture` (email unique normalisé en minuscules, `consentementLe`, `createdAt`) et `TentativeInscription` (`cle` = empreinte SHA-256 salée par `AUTH_SECRET`, « ip:… » ou « email:… » ; index sur `(cle, createdAt)` et `createdAt`). Instants en `timestamptz` (AD-5). Migration `20261027230000_inscriptions_ouverture`, générée par `prisma migrate diff` et vérifiée sans écart.
- `src/lib/demandes` : `inscrireOuverture({ email, consentement, ip })` → `{ ok }` ou `{ ok: false, code }` (`email_invalide`, `consentement_manquant`, `trop_de_demandes`) ; chaque envoi compte (même invalide), IP absente → clé commune, purge des traces plus anciennes que la fenêtre ; e-mail déjà inscrit → succès sans doublon ni nouvelle date (`createMany` + `skipDuplicates`, sûr en cas d'envois simultanés). `compterInscriptionsOuverture()`, `listerInscriptionsOuverture()`. `email.ts` : `normaliserEmail()` (pure).
- Seuils dans `reglages` : `LIMITES_INSCRIPTION_OUVERTURE` = 10 envois par IP et 3 par e-mail sur 60 minutes.
- `POST /api/inscription-ouverture` (route handler : page statique, sans action serveur ; hors middleware, donc joignable pendant la maintenance) : messages en français, 400 / 429 ; corps non conforme → 400 `requete_invalide` ; `Origin` d'un autre site → 403 ; en cas d'erreur, 503 et journal du seul type d'erreur. IP lue dans `x-forwarded-for` (réécrit par Vercel).
- `GET /api/admin/inscriptions-ouverture` : CSV réservé aux admins (via `acces`), cellules entre guillemets, formules neutralisées, CRLF et BOM UTF-8 pour Excel. Tableau de bord admin : nombre d'inscrits et lien d'export.
- `public/maintenance.html` : case de consentement, message d'erreur (`role="alert"`), envoi par `fetch`, saisie conservée en cas d'erreur, plus de `console.log` de l'e-mail.
- `tests/demandes.test.ts` (13 tests, base jetable) : normalisation ; enregistrement sans doublon ; rien sans consentement ou e-mail invalide ; limites par IP et par e-mail ; empreintes sans IP ni e-mail en clair ; IP absente ; levée de la limite après la fenêtre et purge ; réponses de la route, corps invalides, autre origine ; aucun e-mail journalisé sur une erreur provoquée ; export refusé hors admin, CSV (BOM, CRLF) et formule neutralisée.
- Vérifié de bout en bout (Playwright, `next start` en maintenance sur base locale) : page servie, refus sans consentement avec saisie conservée, accusé avec consentement, ligne en base, e-mail absent du journal du serveur. 47 tests, `tsc --noEmit`, `npx eslint .`, liste d'exceptions (22), `npm run build` OK.
- Les stories 1.2 à 1.8 restent en `review` (réglages du porteur non confirmés).
- `[ASSUMPTION]` à valider par le porteur : texte de la case de consentement ; seuils 10 envois par IP / 3 par e-mail / 60 min ; route handler (exception à la convention « actions serveur » d'AR-17, déjà relevée par la revue UX-code : la page est statique).

## Review Triage Log

- Instants sans fuseau (`TIMESTAMP` au lieu de `timestamptz`, AD-5) — medium : vrai ; corrigé, migration régénérée.
- Limites contournables par des envois simultanés ; `upsert` concurrent → 503 — low / medium : limites souples assumées (commentaire) ; `createMany` + `skipDuplicates` élimine l'erreur.
- Limite par IP absente quand l'IP manque — medium : vrai ; clé commune. `x-forwarded-for` falsifiable hors Vercel — low : Vercel le réécrit ; rejeté.
- Sel vide si `AUTH_SECRET` absent — low : `AUTH_SECRET` est obligatoire pour NextAuth en production ; rejeté.
- Purge sans index utilisable — low : index sur `createdAt` ajouté.
- Test « aucun e-mail journalisé » qui ne pouvait pas échouer — medium : vrai ; remplacé par un test sur erreur provoquée.
- Chemins non testés (fenêtre, IP absente, corps invalides, formule CSV) — low : tests ajoutés.
- Corps non JSON → mauvais message ; `null` → 503 — low : vrai ; 400 `requete_invalide`.
- Désinscription, durée de conservation, mentions de confidentialité, preuve du texte accepté — medium : relève des décisions du porteur (NFR-6, AQ-6) ; différé (deferred-work) et posé dans la PR.
- Inscription d'adresses par un autre site, sans double confirmation — medium : contrôle d'`Origin` ajouté ; double confirmation (double opt-in) = décision du porteur ; différé.
- Exception route handler et seuils non consignés — low : notés en `[ASSUMPTION]` et dans la PR.
- Envois ratés comptés dans la limite par e-mail (blocage possible d'une adresse pendant une heure) — low : compromis assumé contre l'abus ; rejeté.
- CSV sans CRLF ni BOM — low : corrigé.
- Validation d'e-mail trop permissive — low : resserrée (caractères usuels, pas de « .. », partie locale ≤ 64).
- Statut de suivi — low : passé en `review`.
