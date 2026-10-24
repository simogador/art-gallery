# Guide pas à pas — Refonte d'Errancy avec BMAD

> Une étape = **une nouvelle conversation** = **une PR**. Chaque nouvelle conversation repart du
> dépôt (branche `main`) : il faut donc **fusionner la PR de l'étape précédente avant d'ouvrir la
> suivante**. Tout ce que les agents doivent savoir est dans `AGENTS.md` et `docs/` ; inutile de
> leur réexpliquer le projet.

## Déroulé de chaque conversation

1. Ouvrir une **nouvelle conversation** sur le dépôt `simogador/art-gallery`.
2. Coller le **message de départ** de l'étape (ci-dessous).
3. Répondre aux questions de l'agent ; « je ne sais pas encore » est une réponse valable.
4. Relire le document produit et demander des corrections jusqu'à ce qu'il vous convienne.
5. Terminer par : **« Valide, commite, pousse et ouvre une PR. »**
6. Fusionner la PR sur GitHub (pour du code : après avoir regardé la préversion Vercel).
7. Passer à l'étape suivante, dans une nouvelle conversation.

Perdu à tout moment ? Nouvelle conversation, taper `/bmad-help`.

---

## En parallèle, hors BMAD (bloquant pour l'étape 4)

**Rendez-vous avec un expert-comptable ou un avocat marocain** sur le montage de paiement
(société d'exploitation au Royaume-Uni ou aux États-Unis, facturation depuis Errancy Maroc,
autorisations de l'Office des Changes). Question à poser et contexte :
`_bmad-output/planning-artifacts/research/technical-paiement-place-de-marche-art-exploitant-2026-10-24/research.md`.
Notez la réponse dans `docs/decisions-porteur.md` (ou dictez-la à l'agent de l'étape en cours).

---

## Étape 1 (facultative, recommandée) — Étude des concurrents

**Quand :** maintenant. **Durée :** une conversation courte.

```
/bmad-deep-recon
Lance la recherche ici, type competitive. Concurrents : Singulart, Saatchi Art, Artsy,
Artmajeur, Massinart. Décision servie : comment les fiches œuvres, filtres, conseils,
garanties et pages artistes d'Errancy doivent lever l'incertitude de l'acheteur
(voir docs/strategie-refonte.md §3 et §4).
```

**Livrable :** `_bmad-output/planning-artifacts/research/competitive-…/research.md`.

## Étape 2 — Cahier des charges (PRD)

**Quand :** après fusion de l'étape 1 (ou maintenant si vous la sautez).

```
/bmad-prd
Crée le PRD de la refonte d'Errancy (projet existant). Sources : docs/strategie-refonte.md,
docs/decisions-porteur.md, docs/analyse-projet.md et les rapports dans
_bmad-output/planning-artifacts/research/. Priorité : convertir d'abord. Le montage de paiement
est une décision en attente d'avis juridique : traite-le comme question ouverte.
```

**Vous serez interrogé sur :** le périmètre du premier lancement, ce qu'on garde ou supprime,
les priorités. **Livrable :** `_bmad-output/planning-artifacts/prd.md`.
**Conseil :** avant de valider, demandez « applique bmad-advanced-elicitation (pré-mortem) au PRD ».

## Étape 3 — Expérience et design (UX)

**Quand :** après fusion du PRD.

```
/bmad-ux
Crée la spécification UX d'Errancy à partir du PRD. Points clés : fiche œuvre qui lève
l'incertitude (dimensions, prix total, délai, mise en situation), conseil WhatsApp, parcours
d'achat, espace artiste (dépôt d'œuvres, expédition, suivi), site international.
```

**Livrables :** `DESIGN.md` (apparence) et `EXPERIENCE.md` (comportement).

## Étape 4 — Architecture technique

**Quand :** après fusion de l'UX **et idéalement après l'avis juridique sur le paiement**.

```
/bmad-architecture
Crée l'architecture de la refonte d'Errancy (projet existant : lis le code). Respecte AGENTS.md :
on améliore la pile actuelle, pas de remplacement. Tranche le paiement de place de marché
selon docs/decisions-porteur.md et le rapport de recherche paiement.
```

Si l'avis juridique n'est pas encore là, ajoutez : « le paiement reste différé ; conçois le reste
pour qu'il s'y branche ensuite ». **Livrable :** `architecture.md` avec les décisions (ADR).

## Étape 5 — Découpage en epics et stories

**Quand :** après fusion de l'architecture.

```
/bmad-create-epics-and-stories
Découpe le PRD et l'architecture en epics et stories testables, dans l'ordre de priorité de
docs/strategie-refonte.md (convertir d'abord).
```

**Livrable :** la liste des epics et des stories avec critères d'acceptation.

## Étape 6 — Contrôle avant développement

**Quand :** après fusion des stories.

```
/bmad-sprint-planning
Lance la planification du sprint (vérification de préparation incluse).
```

**Règle :** ne rien coder tant que le résultat n'est pas **PASS**. En cas de CONCERNS ou FAIL,
corrigez le document signalé (nouvelle conversation avec la commande de l'étape concernée).
**Livrable :** `sprint-status.yaml`.

## Étape 7 — Développement, une story par conversation

**Quand :** après PASS ; répéter pour chaque story.

```
/bmad-build
Implémente la prochaine story de sprint-status.yaml. Vérifie lint et build avant de pousser,
puis ouvre une PR.
```

Pour chaque story : regarder la **préversion Vercel** de la PR, tester, puis fusionner.
Pour une story sensible (paiement, comptes, commandes), demander en plus `/bmad-code-review`
ou `/bmad-walkthrough` avant de fusionner.

## Étape 8 — Tests et bilan, à la fin de chaque epic

```
/bmad-qa-generate-e2e-tests
Crée les tests automatisés de l'epic terminé (panier, paiement, double vente…).
```

```
/bmad-retrospective
Fais la rétrospective de l'epic terminé.
```

---

## À tout moment

| Situation | Commande (nouvelle conversation) |
|---|---|
| Je ne sais plus où j'en suis | `/bmad-help` |
| Un agent a fait une erreur à ne pas répéter | `/bmad-project-context` puis « record : … » |
| Je change d'avis en cours de route (prix, périmètre, paiement) | `/bmad-correct-course` |
| Je veux l'avis de plusieurs experts | `/bmad-party-mode` |
| Mise en production (fin de maintenance) | Vercel → variables → `MAINTENANCE_MODE=off`, et ouvrir `robots.txt` |
