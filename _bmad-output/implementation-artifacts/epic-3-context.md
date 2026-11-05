# Epic 3 Context: Le visiteur trouve une œuvre et répond seul aux quatre questions

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Permettre au visiteur, surtout sur mobile et souvent à l'étranger, de trouver une œuvre adaptée à son mur et à son budget puis de répondre seul aux quatre questions (« Ira-t-elle chez moi ? », « Combien au total ? », « Quand la recevrai-je ? », « Est-ce sérieux ? ») sans avoir à demander. L'epic pose les fondations transverses (accessibilité, jetons de design, dictionnaire et formats français, prix total livré calculé en un seul endroit, journal d'événements et cache frais en moins de 60 s), puis refait la fiche œuvre, ses états vendue/retirée, le référencement, la galerie filtrée, l'accueil curatorial et les pages artistes. Tout reste en Lot 1 : aucun « Acheter » ; la barre d'actions (WhatsApp, visite) vient en Epic 4.

## Stories

- Story 3.1: Une interface lisible et accessible partout
- Story 3.2: Textes, montants et unités au même format partout
- Story 3.3: Pays de livraison et prix total calculé en un seul endroit
- Story 3.4: Journal d'événements et pages publiques toujours fraîches
- Story 3.5: Fiche œuvre : photos et rangée Taille, Prix livré, Délai
- Story 3.6: Fiche œuvre : les quatre questions et les signes de sérieux
- Story 3.7: Fiche d'une œuvre vendue ou retirée
- Story 3.8: Fiches et pages artistes bien référencées
- Story 3.9: Galerie filtrée pour un mur et un budget
- Story 3.10: Accueil curatorial
- Story 3.11: Pages artistes

## Requirements & Constraints

- **Taille** : dimensions en cm et en pouces (les deux toujours visibles sur la fiche, priorité selon la bascule cm/in mémorisée sur l'appareil), orientation et format petit/moyen/grand. Les seuils de format sont un réglage de l'équipe (UXQ-7, non fixé) : jamais codés en dur.
- **Prix total** : prix de l'œuvre + frais de la zone du pays choisi, en euros, toujours accompagné de « Droits et taxes d'import éventuels non inclus ». Le prix affiché (fiche, vignette, filtre) doit être identique à celui qui sera demandé à la commande. Pays non livré : « Pas de livraison vers [pays] » et « [Artiste] ne livre pas encore [pays]. »
- **Délai total** : fourchette de jours = préparation + transport minimal/maximal de la zone.
- **Signes de sérieux** : histoire courte, disponibilité, « Sélectionnée par Errancy », certificat d'authenticité signé par l'artiste, résumé de la politique de retour **sans durée ni gratuité** (OQ-2, OQ-4 ouvertes), lien vers l'artiste ; lien vers les pages de confiance seulement une fois publiées (Epic 7).
- **Interdits de ton** : compte à rebours, prix barré, promotion, « dernière chance », « Garantie Errancy », nom de prestataire de paiement, tutoiement, jargon technique.
- **Catalogue réel uniquement** : seules les œuvres visibles (publiées, non retirées, artiste avec accord signé et actif) apparaissent ; les coordonnées de l'artiste ne sont jamais affichées.
- **Galerie** : 9 filtres (prix total pour le pays, format, orientation, couleur dominante, ambiance, technique, artiste, pays de l'artiste, disponibilité) ; filtres dans l'URL (partageables, retour arrière fiable).
- **Accueil** : sélection marquée par l'équipe + dernières œuvres publiées ; une fiche à un clic.
- **Page artiste** : portrait, démarche, formation, expositions, photo d'atelier, œuvres disponibles avec prix livré et délai, « Sélectionné par Errancy » ; contenu géré par l'équipe (OQ-14).
- **Fraîcheur** : une vente ailleurs, un retrait ou une publication se reflète publiquement en moins de 60 s.
- **Performance mobile** : rapide en 4G, images au bon format et chargées au défilement ; LCP < 2,5 s (hypothèse à confirmer).
- **Référencement** : titre, description, URL canonique en français, balises de partage (image de mise en situation), sitemap des fiches publiées non retirées et des pages artistes, 301 à tout changement d'URL. Ne jamais toucher `public/robots.txt` ni `MAINTENANCE_MODE`.
- **Accessibilité (WCAG 2.1 AA supposé)** : clavier dans l'ordre de lecture, lien d'évitement, focus visible, contrastes, libellés, texte alternatif (œuvre, artiste, prise de vue), recalculs annoncés, cibles 44 × 44 px, zoom 200 % sans défilement horizontal, `lang="fr"`.
- **Langue et devise** : français et euros seulement, aucun sélecteur de langue ni de devise (OQ-6), mais conception prête pour l'international.

## Technical Decisions

- **Prix et délai en un seul endroit** : une seule fonction de `livraison` renvoie, pour une œuvre et un pays, prix total (centimes et euros) et délai total, ou « pas de livraison ». Elle existe aussi sous forme de fragment de requête pour filtrer/trier la galerie ; un test prouve que les deux formes donnent le même montant. Aucun composant ne calcule de prix.
- **Pays choisi** : code ISO dans le cookie `pays`, lu par le serveur et passé explicitement aux fonctions de prix ; défaut France, modifiable (OQ-13 ouverte). Changer de pays recalcule côté serveur.
- **i18n** : `src/lib/i18n/` porte un dictionnaire français typé et les fonctions de formatage communes (montants « 1 450 € » avec espace fine insécable, dimensions « 61 × 76 cm », dates, heures « 15 h 42 »), locale `fr`, sans bibliothèque d'internationalisation. Une règle de lint signale les chaînes visibles en dur dans les composants de l'epic. Les textes d'erreur viennent du dictionnaire à partir du `code` des résultats `{ ok, code }`.
- **Journal d'événements (outbox)** : module `evenements` avec catalogue typé unique (`src/lib/evenements/catalogue.ts`, noms `NomAuPasseCompose` en français, charge utile = ids seulement, jamais de donnée personnelle), écriture dans la transaction du changement d'état, réclamation atomique (événement, gestionnaire) avant tout effet, répartition après la réponse par `waitUntil` de `@vercel/functions` (Next 14 ; `after()` viendra en Epic 5), abonnements dans `src/lib/abonnements.ts`. Un gestionnaire ne fait rien si l'entité a déjà quitté l'état attendu. Test obligatoire : un même événement traité deux fois en parallèle ne produit l'effet qu'une fois.
- **Cache** : sur les données du catalogue (pas les pages), étiqueté par œuvre et par artiste, revalidation ≤ 60 s ; invalidation par gestionnaire d'événement après validation de la transaction (publication par `curation`, disponibilité par `disponibilite`). Les pages qui affichent un prix se rendent par requête avec le cookie `pays`. La disponibilité affichée est indicative.
- **Sens des dépendances** : interface → `catalogue`, `curation`, `disponibilite`, `livraison` ; `curation` et `disponibilite` → `evenements`. Une réaction d'un module en amont passe par un événement, jamais par un appel direct. `reglages` est importable partout (seuils de format notamment).
- **Données artiste** (portrait, démarche, formation, expositions, photo d'atelier) écrites par `curation` ; sélection de l'accueil marquée par l'équipe dans l'administration.
- **Images** : Cloudinary + `next/image`, au format et à la taille de l'écran.
- **Mutations** par actions serveur ; route handlers réservés aux appelants externes.

## UX & Interaction Patterns

- **Jetons** : conserver palette et polices de `tailwind.config.ts` ; ajouter `heading-sm`, `body-strong`, `price-lg`, `label-caps`, `caption`, `button`, `input`, `touch-target` (44 px), `gutter-mobile`. L'or est décoratif seulement (jamais texte, fond de bouton, focus, état) ; aucun texte en `neutral-400`. Coins 2 px, interface plate, aucune couleur d'état ni mode sombre. Focus : contour noir 2 px, décalage 2 px. Propriétés CSS logiques uniquement. Mouvement limité à `fade-in`/`scale-in`, coupé sous `prefers-reduced-motion`.
- **Fiche (`/galerie/[id]`, id = slug)** : photo de mise en situation en pleine largeur, titre en `display-sm`, libellé de disponibilité (point + « Disponible »/« Réservée »/« Vendue », jamais d'heure de fin), puis `tile-row` Taille / Prix livré (+ « Modifier ») / Délai avec liseré or. Carrousel : balayage et boutons, jamais automatique, compteur « 1/4 », légende, plein écran avec zoom. Chargement : rangée et titre avant les photos. Puis quatre `details`/`summary` natifs dans l'ordre fixe, seule la première ouverte, état non mémorisé, chiffres identiques à la rangée. À partir de `lg` : deux colonnes (photos à gauche, bloc collant à droite).
- **États publics** : `vendue` et `vendue_ailleurs` → « Vendue », mêmes infos sans prix livré actif, œuvres proches du même artiste et lien vers sa page ; `retiree` ou inconnue → 301 vers la page de l'artiste, ou la galerie si artiste inconnu.
- **Galerie** : puces de filtre (« × » retire et relance), panneau « Modifier les filtres », rappel « N œuvres · prix livré [pays] » ; vignette = une seule cible (artiste, dimensions, prix livré, délai, ni prix barré ni étiquette promo) ; 2 colonnes mobile, 3 de `md` à `lg`, 4 au-delà ; « Afficher plus d'œuvres », pas de défilement infini (UXQ-11). Vide : « Aucune œuvre ne correspond à ces filtres. » + retirer le dernier filtre ; chargement : vignettes squelettes `neutral-200` ; erreur : « La galerie ne s'est pas chargée. Réessayer », filtres conservés.
- **En-tête** : « Menu », la marque, « ‹ [écran précédent] » sur les écrans profonds ; ni favoris ni « Panier » tant que le Lot 2 est fermé. `ornament-rule` (filet or 40 px) en `aria-hidden`. Aucun carrousel ni vidéo qui démarre seul.

## Cross-Story Dependencies

- 3.1 (jetons, accessibilité) et 3.2 (dictionnaire, formatage, bascule cm/in) sont les fondations de toutes les surfaces de l'epic.
- 3.3 (fonction de prix + fragment de requête, cookie `pays`) précède 3.5, 3.6, 3.9 (filtre de prix) et 3.11.
- 3.4 (événements, cache) s'appuie sur la publication (story 2.7) et la disponibilité (story 2.8), qui doivent écrire leurs événements ; il précède les pages publiques à prix (3.5 à 3.11).
- 3.5 précède 3.6 et 3.7 ; 3.7 réutilise la page artiste (3.11) comme cible de redirection ; 3.8 dépend des fiches et pages artistes.
- Epic 2 : zones et offres de livraison (2.3, 2.6), photos et métadonnées du dépôt (2.5), règle de visibilité et catalogue réel (2.9).
- Epic 4 apporte la barre d'actions, le Conseil WhatsApp, « Demander une sélection » et la mesure ; Epic 5 remplacera `waitUntil` par `after()` ; Epic 7 publie les pages de confiance liées depuis la fiche. « Acheter » reste piloté par `lot2Ouvert()` (story 1.7).
