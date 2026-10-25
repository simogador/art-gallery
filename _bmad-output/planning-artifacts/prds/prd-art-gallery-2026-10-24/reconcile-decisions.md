---
title: "Réconciliation — decisions-porteur.md ↔ PRD refonte Errancy"
created: 2026-10-24
source: docs/decisions-porteur.md
cible: prd.md, addendum.md (+ .memlog.md pour les décisions du 2026-10-24)
---

# Réconciliation : `docs/decisions-porteur.md` ↔ PRD

Le PRD et l'addendum n'ont pas été modifiés. Les numéros de ligne renvoient à `docs/decisions-porteur.md` (« src l.N »), à `prd.md` (« PRD l.N ») et à `addendum.md` (« add. l.N »).

## 1. Ce qui est conforme (pour mémoire)

- **Montage de paiement et entité juridique.** Ils restent une question ouverte partout : PRD l.24, FR-14 (l.244-249), §7 l.419, OQ-1 (l.464-472) et addendum §B (« NON décidées », l.49). La recommandation Royaume-Uni / États-Unis est bien présentée comme une recommandation, avec l'avis juridique en préalable (src l.17). La tension entre « galerie qui encaisse » et le statut d'intermédiaire est relevée (l.472).
- **Décisions reprises fidèlement :**
  - international et diaspora (src l.10 → PRD l.28) ;
  - l'artiste vend, Errancy est l'intermédiaire (src l.14 → l.28, l.337, l.418, §10) ;
  - artistes de tous pays (src l.16 → l.28) ;
  - commission de 30 % avec assiette ouverte (src l.48 → l.131, OQ-3) ;
  - l'artiste expédie (src l.18 → l.28, FR-20, FR-22) ;
  - catalogue de démonstration à remplacer (src l.42 → FR-16, Lot 1).
- **Décisions du 2026-10-24 (.memlog) :**
  - achat sans compte → FR-10 ;
  - artistes sur sélection → §2.2 l.67, §7 l.417, FR-25 ;
  - visites à distance → UJ-4 l.102, FR-8 ;
  - première vente sous ~12 semaines → SM-1 l.429 ;
  - OQ-7, OQ-10 et OQ-11 marquées « ne sait pas encore ».
- **Conséquences à traiter qui ont trouvé leur place :**
  - double vente (src l.90-91) → FR-12, FR-21, NFR-4, SM-C1 ;
  - livraison : frais et délais, suivi, prix total et délai visibles avant paiement (src l.79-81) → FR-3, FR-4, FR-11, FR-20, FR-22 ; douane, assurance et casse → OQ-5 ;
  - commission : assiette, frais de paiement, date de paiement de l'artiste, retours (src l.86-88) → OQ-3, OQ-4 ;
  - démonstration à purger (src l.92-93) → FR-16, OQ-10 ;
  - rôle d'intermédiaire, CGV, rétractation et authenticité (src l.77-78) → FR-23, FR-24, §10.

## 2. Écarts

| # | Citation source | Emplacement PRD | Gravité | Correction proposée |
|---|---|---|---|---|
| E1 | src l.75-76 : « avec vérification d'identité des artistes et disponibilité de Stripe dans leurs pays » ; src l.84-85 : « vérification d'identité, fiscalité des versements » | **Absent.** OQ-1 (l.467-469) ne pose que « qui encaisse / quel prestataire / comment l'artiste est payé ». Aucune FR ni NFR sur la vérification d'identité des artistes (KYC) ni sur la fiscalité des versements. | **Élevée** | Ajouter à OQ-1 deux sous-questions : la vérification d'identité des artistes (qui la fait, à quelle étape : avant publication ou avant le premier versement) et la fiscalité des versements (déclarations, retenues). Ajouter à FR-20 ou FR-25 une exigence d'attente : « l'artiste fournit les informations requises par le montage retenu (OQ-1) avant son premier versement ». |
| E2 | src l.16 : « Pays de résidence des artistes : **tous pays** » ; src l.82-85 : « solution de repli (versement manuel, autre prestataire) » | add. l.65 : l'option D prévoit « une liste d'attente pour les pays sans rail ». Ni OQ-1 ni §11 ne signalent qu'elle contredit la décision « tous pays ». La solution de repli (versement manuel) n'est pas nommée dans OQ-1. | Moyenne | Dans OQ-1 (« Tension à arbitrer »), ajouter que l'option D exclurait de fait des artistes, contrairement à src l.16. Ajouter la question : « solution de repli pour les pays sans rail : versement manuel, autre prestataire, ou refus ? » La décision revient au porteur. |
| E3 | Décision du 2026-10-24 (.memlog l.17) : « Visites à distance (pas de showroom), atelier si l'artiste l'accepte » | OQ-8 (l.496-497) demande encore : « existe-t-il un showroom ? Les visites se font-elles à distance seulement, ou aussi en atelier ? ». Elle contredit UJ-4 (l.102) et la décision. | Moyenne | Réduire OQ-8 au seul point encore ouvert : « avec qui (artiste ou conseiller), et quel outil de visio ? ». Indiquer : « Décidé le 2026-10-24 : pas de showroom ; à distance, ou en atelier si l'artiste l'accepte. » |
| E4 | src l.89 : « **Multi-devise et multilingue** : à arbitrer pour un public international et diaspora » ; src l.12-13 : langues et devises « … » | NFR-8 (l.391) et §6.2 (l.410) **décident** que le multilingue et le multidevise sont exclus du MVP. OQ-6 (l.490) suppose déjà « le français et l'euro » comme base. UJ-1 (l.80) affiche pourtant des dollars canadiens, ce qui contredit NFR-8. | Moyenne | Marquer l'exclusion du MVP et le couple français + euro comme `[ASSUMPTION]`, à confirmer par le porteur (OQ-6). Rendre UJ-1 cohérent : soit un prix en euros avec conversion indicative, soit un multidevise d'affichage inclus si le porteur le décide. Reformuler OQ-6 : « quelle devise de référence et quelles langues au lancement ? » |
| E5 | src l.18 : « zones et **prise en charge des frais** : … » (non décidé) | Glossaire « Prix total » (l.126) : les frais de livraison font partie du « montant que l'acheteur paie ». FR-3 et FR-11 en découlent. Cela tranche que l'acheteur paie la livraison, alors que la source laisse la question ouverte. Le « cadre » ajouté (l.126) ne figure dans aucune source. | Moyenne | Ajouter à OQ-5 : « Qui paie la livraison : l'acheteur (ajoutée au prix), ou l'artiste (incluse dans son prix) ? » Garder FR-3 sur le seul principe de src l.81 (« l'acheteur doit voir le prix total et le délai avant de payer »), sans préjuger du payeur. Retirer le cadre du glossaire ou le marquer `[ASSUMPTION]`. |
| E6 | src l.87-88 : « quand l'artiste est payé (après réception par l'acheteur ?), et comment sont gérés retours et remboursements » (non décidé) ; src l.78 : authenticité à traiter | FR-5 (l.177) affiche « la politique de retour (14 jours) » et UJ-3 (l.99) écrit « livrée, ce qui ouvre le délai de retour de 14 jours », comme si c'était acquis. Le glossaire (l.130) définit un certificat « signé par l'artiste ». Ces points dépendent pourtant de OQ-2 et OQ-4. | Moyenne | Dans FR-5 et UJ-3, distinguer le droit légal de rétractation (§10) de la politique commerciale de retour (OQ-4), en marquant les 14 jours `[ASSUMPTION]` ou « selon OQ-4 ». Pour le certificat, indiquer que l'émetteur (artiste ou Errancy) dépend de OQ-2. |
| E7 | Politique du dépôt : une décision structurante doit figurer dans `docs/decisions-porteur.md` ou dans un document BMAD validé | Les cinq décisions confirmées le 2026-10-24 (.memlog l.14-18 : lancement réel, achat sans compte, sélection, visites à distance, ~12 semaines) ne figurent **ni dans le journal de la source** (src l.62-69) **ni comme décisions datées dans le PRD**, qui est encore en `status: draft` (l.3). « Lancement réel » n'apparaît nulle part en clair dans le PRD. | Moyenne | Proposer au porteur d'ajouter ces cinq lignes au journal de `docs/decisions-porteur.md` (§2 Showroom, §3 Rendez-vous, §7 Date et ambition). Dans le PRD, ajouter un encadré « Décisions confirmées (2026-10-24) » en §0 et une phrase sur le lancement réel en §1. |
| E8 | src l.77-78 : « CGV et mentions à rédiger en conséquence (**responsabilité**, rétractation, authenticité, **litiges**) » | FR-23 (l.337-339) couvre le statut de vendeur et la rétractation. La **répartition des responsabilités** et le **traitement des litiges** (réclamation, médiation, interlocuteur) n'ont pas de critère. Ils ne sont suivis que par SM-C2. | Faible | Ajouter à FR-23 un critère : « les CGV précisent la responsabilité de l'artiste et celle d'Errancy, ainsi que la procédure de réclamation et de litige ». Rattacher le fond à OQ-2. |
| E9 | src l.15 : « Errancy perçoit la commission — pays et forme juridique encore à préciser » ; src l.17 : « non pour une société marocaine » | add. l.66 : « Errancy Maroc garde la marque… » présuppose une entité marocaine existante. C'est contenu dans une section marquée non décidée, mais la formulation est affirmative. | Faible | Reformuler en conditionnel : « dans ce schéma, une entité marocaine garderait… ». |
| E10 | src l.34 : « Ventes réalisées à ce jour : … » ; src l.50 : « Éditions limitées autorisées par certains artistes ? : … » | PRD l.424 : « aucune baseline n'existe ». PRD l.68 et §6.2 : les éditions sont exclues du MVP. Le porteur n'a répondu à aucun des deux points. | Faible | Marquer « aucune vente ni donnée de trafic » `[ASSUMPTION]` jusqu'à la réponse de src l.33-34. Rattacher l'exclusion des éditions à la stratégie (`docs/strategie-refonte.md`) et ajouter src l.50 à OQ-10. |

## 3. Synthèse

- **Le montage de paiement et l'entité juridique** sont correctement tenus en question ouverte. Aucune recommandation de l'étude n'est présentée comme une décision dans le PRD.
- **Les écarts principaux :**
  - une conséquence à traiter est absente : la vérification d'identité des artistes et la fiscalité des versements (E1) ;
  - plusieurs arbitrages sont présentés comme acquis alors qu'ils sont non décidés : multidevise et multilingue (E4), payeur de la livraison (E5), retours de 14 jours et certificat (E6) ;
  - OQ-8 est devenue obsolète depuis la décision sur les visites (E3) ;
  - les décisions du 2026-10-24 ne sont pas reportées dans la source (E7).
