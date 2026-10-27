- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-correctifs-de-securite-et-node-24.md`
  summary: Décider si `engines.node` reste `>=22.12` ou devient borné (`24.x` ou `22.x || 24.x`).
  evidence: Vercel utilise `engines.node` en priorité sur le réglage Node du projet ; une plage ouverte `>=` peut suivre la plus récente version majeure proposée par Vercel. Par ailleurs `eslint-visitor-keys@5` (lint) exige `^22.13` : avertissement `EBADENGINE` sous 22.12.x. Valeur actuelle fixée par la décision du porteur du 2026-10-27, donc question à lui poser.
  resolution: Résolu le 2026-10-27 par le porteur : `engines.node` `24.x`, appliqué dans la story 1.1 (PR #7).
