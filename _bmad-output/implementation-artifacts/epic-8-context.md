# Epic 8 Context: Chaque commande est menée jusqu'à sa clôture, et l'artiste est payé

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Après la confirmation d'une commande (Epic 6), l'artiste la prend en charge puis l'expédie avec un numéro de suivi, l'adresse de l'acheteur ne lui étant visible qu'entre la prise en charge et la livraison. L'équipe voit chaque commande, est alertée des retards, constate la livraison, traite réclamations, retours et remboursements ; chaque commande se clôt, et la somme due à l'artiste est calculée en un seul endroit, visible par l'artiste (« Ce qu'on vous doit ») comme par l'équipe. Les valeurs non décidées (délai de retour, seuil d'assurance, assiette de la commission) sont des réglages ; rembourser et verser restent manuels tant que le montage de paiement (OQ-1) est ouvert.

## Stories

- Story 8.1: L'artiste prend en charge ses commandes
- Story 8.2: L'artiste expédie et saisit le suivi
- Story 8.3: Commandes et alertes de l'équipe
- Story 8.4: Livraison constatée
- Story 8.5: Réclamation et retour
- Story 8.6: Remboursements tracés
- Story 8.7: Clôture des commandes
- Story 8.8: Somme due à l'artiste

## Requirements & Constraints

- L'artiste est prévenu de chaque commande sur ses œuvres ; il confirme la prise en charge sous 48 h (hypothèse du PRD, réglable), puis expédie avant la fin du délai de préparation qu'il a déclaré et saisit transporteur et numéro de suivi ; l'acheteur est prévenu à chaque étape.
- L'adresse et le téléphone de l'acheteur ne sont visibles par l'artiste qu'entre la prise en charge et la livraison ; avant et après, seuls le prénom et le pays.
- Un artiste ne voit ni n'agit jamais sur la commande d'un autre artiste ; seul l'admin accède aux écrans et actions de l'équipe.
- Au-delà d'un seuil de prix figé (réglage, OQ-5) : expédition assurée avec référence obligatoire, livraison constatée seulement sur preuve enregistrée par l'équipe.
- Annulation par l'équipe : motif obligatoire, tracée (qui, quand, motif), remboursement de l'allocation demandé, acheteur et artiste prévenus.
- La somme des remboursements d'une commande ne dépasse jamais son allocation (refus explicite).
- Aucune durée de retour, gratuité, frais de retour ni choix remboursement/avoir codé en dur (OQ-2, OQ-4) ; commission 30 % (décision du porteur), assiette OQ-3 en réglage figé sur la commande à la confirmation.
- Coordonnées de l'artiste jamais montrées à un acheteur ; journaux et charges d'événements : ids seulement.

## Technical Decisions

- États de commande (glossaire) : `en_attente_paiement`, `confirmee`, `prise_en_charge`, `expediee`, `livree`, `close`, `annulee`, `retournee`. Ils ne changent que par les fonctions de `commandes`, qui vérifient la transition dans la table unique de transitions, vérifient l'acteur (relu en base par `acces`), horodatent, retiennent l'auteur et écrivent l'événement dans la même transaction.
- Échéances stockées sur la ligne concernée (prise en charge attendue, expédition attendue, fin du délai de retour) ; « en retard » se calcule à la lecture par le module propriétaire ; seul le balayage pose les transitions finales à date (clôture), de façon idempotente.
- Données de l'acheteur filtrées à la source par destinataire : pour un destinataire `artist` (écran ou e-mail), `commandes` ne renvoie adresse et téléphone que pour `prise_en_charge` ou `expediee`.
- Effets (e-mails, alertes, révocation des jetons de suivi à la clôture) par le journal d'événements : catalogue typé, écriture dans la transaction, répartition attendue après, un e-mail par événement même rejoué.
- Somme due : une seule fonction de `commandes` ; taux et assiette figés à la confirmation, montant recalculé à la clôture (déduction des remboursements), état `à verser`, puis versement par le port Reversement (manuel tant qu'OQ-1 est ouverte). Remboursement rattaché à une paire (paiement, commande).
- Après annulation ou retour accepté, l'équipe fait passer l'œuvre `vendue` à `retiree` par `disponibilite` ; l'artiste peut la remettre en vente (retour en curation).

## UX & Interaction Patterns

- Accueil de l'espace artiste en trois blocs dans l'ordre de l'urgence : À expédier (avec `count-badge` du nombre de commandes à prendre en charge, masqué à zéro), Mes œuvres, Ce qu'on vous doit.
- Commande avant prise en charge : œuvre, prénom et pays de l'acheteur, échéance en heure fixe ; adresse dans une `neutral-zone` (hachurée, jamais interactive, nomme ce qui manque). « Je prends en charge » révèle l'adresse avec le rappel du guide d'emballage ; puis saisie du transporteur et du numéro de suivi, « Marquer comme expédiée ».
- Libellés par état : artiste « À prendre en charge avant [heure fixe] », « Expédiée » ; acheteur (frise de suivi) « Prise en charge par l'artiste [date] », « Expédiée [date] · n° de suivi », « Livrée [date] » + « Signaler un problème » ; annulée/retournée avec l'état du remboursement (`demandé`, `effectué`).
- E-mails : Nouvelle commande (artiste : œuvre, pays, échéance de prise en charge en heure fixe), Prise en charge (acheteur : l'artiste prépare l'œuvre, délai rappelé), Expédition, Livraison, remboursement ; tous avec Conseil WhatsApp ou son repli.
- Reversement : `à verser`, `versée`, `bloquée` ; moyen de versement en zone neutre.

## Cross-Story Dependencies

- Dépend de l'Epic 6 (commandes, constat, annulation, remboursement `RemboursementCommande`, e-mails de commande) et de l'Epic 7 (suivi par lien, frise de `/suivi`).
- 8.2 suit 8.1 ; 8.3 lit les échéances posées par 8.1 et 8.2 ; 8.4 suit 8.2 ; 8.5 suit 8.4 ; 8.6 généralise les remboursements de la 6.5 ; 8.7 suit 8.4 à 8.6 ; 8.8 s'appuie sur la confirmation et la clôture (8.7).
- Seuil d'assurance (OQ-5), délai de retour (OQ-2, OQ-4), assiette (OQ-3) et moyen de rembourser et verser (OQ-1) restent des décisions du porteur.
