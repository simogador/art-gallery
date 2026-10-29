# Epic 2 Context: Les artistes invités déposent leurs œuvres, l'équipe les publie

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Remplacer le catalogue de démonstration par de vraies œuvres d'artistes sélectionnés : l'équipe invite un artiste, qui crée son accès et dépose depuis son téléphone une œuvre complète (photos, informations, dimensions, prix, expédition par zone, engagements) ; l'équipe la valide ou la renvoie selon une liste de contrôle ; l'artiste tient ensuite la disponibilité de ses œuvres (vendue ailleurs, retirée) en moins d'une minute. L'epic pose aussi les données exactes dont dépend tout le reste (prix en centimes, dimensions en millimètres, publication et disponibilité séparées), par des migrations réversibles, puis retire les anciennes colonnes. Il reste dans le Lot 1 : aucun achat en ligne, aucune réservation acheteur.

## Stories

- Story 2.1: Prix et dimensions exacts au centime et au millimètre
- Story 2.2: Publication et disponibilité, deux états distincts
- Story 2.3: Zones de livraison gérées par l'équipe
- Story 2.4: Invitation et premier accès de l'artiste
- Story 2.5: Déposer une œuvre : photos, informations, dimensions et prix
- Story 2.6: Expédition par zone, engagements et envoi en curation
- Story 2.7: Curation par l'équipe
- Story 2.8: L'artiste tient la disponibilité de ses œuvres
- Story 2.9: Catalogue réel uniquement
- Story 2.10: Suppression des anciennes colonnes

## Requirements & Constraints

- Seules des œuvres et des artistes réels, publiés après curation, apparaissent ; aucune page publique ne lit de données de démonstration ; un artiste n'est publié qu'avec un accord écrit signé enregistré.
- Dépôt complet obligatoire avant envoi en curation : titre, technique, année, histoire courte, ambiance, couleur dominante, hauteur et largeur, prix de l'œuvre seule ; photos de mise en situation avec repère d'échelle, gros plan, lumière du jour (vidéo facultative) ; par zone : frais, délai de préparation, délai de transport min/max ou « je ne livre pas » (au moins une zone livrée) ; visites en atelier oui/non ; engagements certificat, emballage, reprise en cas de retour. Une œuvre sans dimensions ne peut pas être soumise.
- Curation : valider ou renvoyer avec commentaire obligatoire, selon la liste photos requises, fidélité des couleurs, champs complets, cohérence prix et zones ; file triée de la plus ancienne à la plus récente.
- L'artiste peut passer une œuvre en « vendue ailleurs » ou « retirée » à tout moment ; le serveur refuse aussitôt toute nouvelle réservation ou commande, et le site l'affiche en moins de 60 s. L'annulation d'une réservation en cours relève de l'epic 6, mais chaque déclaration retient déjà si elle en a interrompu une.
- Une œuvre retirée redirige en 301 vers la page de l'artiste.
- Un artiste n'accède qu'à ses propres œuvres, contrôle côté serveur couvert par un test ; l'invitation donne le rôle `artist` rattaché à sa fiche.
- Migration progressive : chaque étape réversible, fonctions critiques opérationnelles à chaque déploiement, correspondance des données vérifiée ; les valeurs illisibles (dimensions) sont listées pour saisie manuelle, jamais devinées.
- Accessibilité (clavier, libellés visibles, erreurs reliées, cibles de 44 px, états jamais portés par la couleur seule), interface et URL en français, euros uniquement.
- Aucun e-mail envoyé dans cet epic (prestataire non choisi) : invitation transmise à la main, résultat de curation visible dans l'espace artiste ; les e-mails viennent en epic 4.
- `public/robots.txt` et la maintenance restent inchangés.

## Technical Decisions

- **Sauvegarde et répétition des migrations de données (décision du porteur, 2026-10-29, AQ-4)** : plan gratuit de Neon conservé. Avant chaque migration de données, créer une branche Neon de sauvegarde datée, puis répéter la migration d'abord sur la branche `preview`. Les migrations sont appliquées par le porteur depuis l'éditeur SQL de Neon ; l'agent ne les applique jamais et la PR consigne la répétition (aller, puis retour au commit précédent, site fonctionnel dans les deux cas).
- **Migrations en quatre temps** : ajouter, recopier (script idempotent), basculer les lectures, puis supprimer l'ancien après une période de vérification convenue avec le porteur (story 2.10). Anciennes colonnes `Artwork.price` (`Float`), `Artwork.dimensions` (texte) et `Artwork.available` conservées jusque-là. Tout changement de `schema.prisma` a sa migration commitée ; jamais `db push` sur une base partagée.
- **Formats** : montants en centimes entiers avec devise ISO 4217 (`EUR`), jamais de `Float` pour l'argent ; dimensions en millimètres entiers (profondeur facultative), pouces, orientation et format calculés à l'affichage avec des seuils réglables ; pays en ISO 3166-1 alpha-2 ; instants en UTC.
- **Deux axes d'état** : publication ∈ {`brouillon`, `en_curation`, `publiee`} écrite seulement par `curation` (refusée sans accord signé) ; disponibilité ∈ {`disponible`, `reservee`, `vendue`, `vendue_ailleurs`, `retiree`} écrite seulement par `disponibilite`. Recopie : `available = true` → `publiee` + `disponible`, `false` → `publiee` + `vendue`. Les sept états de l'écran artiste se calculent à partir des deux axes. Visibilité et disponibilité ne se lisent que par le prédicat et le fragment de requête exportés par `disponibilite`.
- **Modules et propriété des données** : `curation` écrit artiste (page, accord signé) et œuvre (descriptif, dimensions, photos, publication) ; `disponibilite` l'axe disponibilité ; `livraison` les zones (équipe) et les offres (artiste, via `curation` qui appelle `livraison`) ; `acces` utilisateurs, rôles, jetons, invitations ; `catalogue` les lectures publiques (reprend `src/lib/db/`). Chaque module a son API dans `index.ts` et s'ajoute à `MODULES_METIER` ; un fichier sort de la liste d'exceptions Prisma quand il passe par un module.
- **Zones et offres** : zones et correspondance pays → zone sont des données modifiables par l'admin (un pays dans au plus une zone ; zone utilisée non supprimable). Une offre par œuvre et par zone acceptée : frais, préparation, transport min/max. Le calcul du prix total et du délai sera une seule fonction de `livraison`.
- **Jetons d'invitation** : créés et vérifiés seulement par `acces`, aléatoires d'au moins 256 bits, empreinte SHA-256 seule stockée avec usage, cible et échéance (réglable, 7 jours par défaut) ; usage unique ; échange contre un cookie `httpOnly` puis redirection sans jeton, `Referrer-Policy: no-referrer`, page exclue de la mesure.
- **Accès** : chaque fonction de module reçoit un acteur et vérifie ses droits ; l'acteur vient de `acteurCourant()`, jamais du rôle du jeton de session.
- **Conventions** : mutations par actions serveur (route handlers réservés aux appels externes, dont l'envoi signé vers Cloudinary) ; résultats `{ ok, code }` (`transition_interdite`, `acces_refuse`…), texte issu du dictionnaire ; entrées validées à la frontière ; noms de code en français sans accent, énumérations en `snake_case` ; aucun e-mail ni jeton dans les journaux ; durées et délais (invitation, réponse de curation) lus par `reglages`.

## UX & Interaction Patterns

- Formulaire de dépôt sur une seule page, cinq sections (Photos, Informations, Dimensions et prix, Expédition, Engagements), progression « N sections sur 5 complètes » et état « Complet » / « À compléter » par section ; brouillon enregistré à la sortie de chaque champ (« Brouillon enregistré »), saisie jamais perdue, validation à la sortie du champ et à l'envoi, jamais à chaque frappe.
- « Envoyer en curation » indisponible tant qu'il manque un élément ; au-dessus, « Il manque N éléments pour envoyer : » avec des liens qui placent le focus sur chaque champ. « Reprendre les zones de ma dernière œuvre » ; sans zone définie, la section Expédition l'explique au lieu d'une liste vide.
- `photo-slot` : une case légendée par prise de vue, ajout depuis l'appareil photo ou la galerie, « Remplacer ». Conversion en pouces et orientation affichées aussitôt.
- Espace artiste : `artist-tabbar` (Accueil, Œuvres, Commandes, Paiements, `aria-current`, latérale dès `lg`) ; accueil avec le seul bloc « Mes œuvres » au Lot 1.
- `status-badge` à libellé et style de trait : Brouillon, En curation, Publiée, Réservée, Vendue, Vendue ailleurs, Retirée ; états vide et chargement prévus.
- Changement de disponibilité en deux touches : `availability-picker` → `confirm-sheet` (monte du bas, « Annuler » à gauche, « Confirmer » à droite, Échap ou voile ferme sans agir et rend le focus, jamais deux feuilles) → `info-banner` (`role="status"`, un seul lien d'action, ex. « Retirée de la vente à 10 h 12. » + « Annuler »). Pas de « Vendue ailleurs » sur une œuvre `vendue` : lien pour écrire à l'équipe.
- Œuvre renvoyée : retour en Brouillon, commentaire de l'équipe en `info-banner` sur la fiche de dépôt. Délai de réponse de la curation affiché après l'envoi.
- Invitation expirée ou utilisée : « Ce lien d'invitation a expiré. » + « Écrire à l'équipe ».
- Écrans admin légers : `/dashboard/admin/artistes` (invitations, accord signé), `/dashboard/admin/oeuvres` (curation).
- Microcopie au vouvoiement, sans jargon (« jeton », « session ») ; accueil et galerie vides affichent l'état vide prévu.

## Cross-Story Dependencies

- 2.1 exige la décision AQ-4 (prise le 2026-10-29) et ouvre la première migration de données ; 2.1 et 2.2 précèdent 2.5 à 2.8, qui écrivent dans les nouvelles colonnes et les deux axes.
- 2.3 attend la composition des zones (OQ-5, encore ouverte) et précède 2.6 ; les noms de zones des maquettes sont illustratifs.
- 2.4 précède le dépôt (2.5, 2.6) ; 2.5 → 2.6 → 2.7 ; 2.7 suppose l'accord signé enregistré pour publier ; 2.8 s'appuie sur des œuvres publiées.
- 2.9 suppose le module `catalogue` (2.1) et des œuvres publiables ; 2.10 vient en dernier, après la période de vérification en production de 2.1 et 2.2, avec une nouvelle branche de sauvegarde datée.
- Hérité de l'epic 1 : préversions isolées sur la branche Neon `preview`, tests sur PostgreSQL jetable, `acces` et `reglages`, règle ESLint d'accès à Prisma.
- Vers la suite : e-mails d'invitation et de résultat de curation en epic 4 ; affichage public des dimensions, prix livré et délai en epic 3 ; réservation et annulation de réservation interrompue (« vendue ailleurs » pendant une réservation) en epic 6.
