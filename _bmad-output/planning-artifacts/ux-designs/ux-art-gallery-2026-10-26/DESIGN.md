---
title: DESIGN — Errancy
status: final
created: 2026-10-26
updated: 2026-10-27
sources:
  - ../../prds/prd-art-gallery-2026-10-24/prd.md
  - ../../prds/prd-art-gallery-2026-10-24/addendum.md
  - ../../research/competitive-fiches-oeuvres-confiance-acheteur-2026-10-24/research.md
  - ../../../../docs/strategie-refonte.md
  - ../../../../docs/analyse-projet.md
  - ../../../../tailwind.config.ts
name: Errancy
description: "Galerie-curatrice en ligne : la base visuelle existante (blanc cassé, noir, or, Cormorant Garamond + Inter, coins quasi droits) conservée et affinée pour le contraste et la lisibilité des états."
colors:
  # Valeurs reprises de tailwind.config.ts (theme.extend.colors). Aucune couleur nouvelle.
  background: '#FAFAF8'
  foreground: '#0A0A0A'
  white: '#FFFFFF'          # palette par défaut de Tailwind, déjà employée par les maquettes (surfaces posées)
  gold: '#C9A84C'           # décoratif uniquement
  gold-light: '#D4B96A'     # décoratif uniquement
  gold-dark: '#A8872E'      # décoratif uniquement
  gold-muted: '#C9A84C1A'   # décoratif uniquement
  neutral-50: '#FAFAF8'
  neutral-100: '#F5F5F2'
  neutral-200: '#E8E8E4'
  neutral-300: '#D4D4CF'
  neutral-400: '#A8A8A2'    # jamais pour du texte
  neutral-500: '#6B6B65'    # gris le plus clair autorisé pour du texte
  neutral-600: '#4A4A45'
  neutral-700: '#2D2D2A'
  neutral-800: '#1A1A18'
  neutral-900: '#0A0A0A'
typography:
  display-2xl: { fontFamily: Cormorant Garamond, fontSize: 4.5rem, fontWeight: '600', lineHeight: '1.1', letterSpacing: -0.02em }
  display-xl: { fontFamily: Cormorant Garamond, fontSize: 3.75rem, fontWeight: '600', lineHeight: '1.1', letterSpacing: -0.02em }
  display-lg: { fontFamily: Cormorant Garamond, fontSize: 3rem, fontWeight: '600', lineHeight: '1.15', letterSpacing: -0.01em }
  display-md: { fontFamily: Cormorant Garamond, fontSize: 2.25rem, fontWeight: '600', lineHeight: '1.2', letterSpacing: -0.01em }
  display-sm: { fontFamily: Cormorant Garamond, fontSize: 1.875rem, fontWeight: '600', lineHeight: '1.25' }
  display-xs: { fontFamily: Cormorant Garamond, fontSize: 1.5rem, fontWeight: '600', lineHeight: '1.3' }
  heading-sm: { fontFamily: Cormorant Garamond, fontSize: 1.25rem, fontWeight: '600', lineHeight: '1.2' }
  body-md: { fontFamily: Inter, fontSize: 1rem, fontWeight: '400', lineHeight: '1.5' }
  body-sm: { fontFamily: Inter, fontSize: 0.875rem, fontWeight: '400', lineHeight: '1.5' }
  body-strong: { fontFamily: Inter, fontSize: 0.875rem, fontWeight: '600', lineHeight: '1.3' }
  price-lg: { fontFamily: Inter, fontSize: 1.25rem, fontWeight: '600', lineHeight: '1.2' }
  label-caps: { fontFamily: Inter, fontSize: 0.75rem, fontWeight: '500', lineHeight: '1.4', letterSpacing: 0.06em }
  caption: { fontFamily: Inter, fontSize: 0.75rem, fontWeight: '400', lineHeight: '1.4' }
  button: { fontFamily: Inter, fontSize: 0.875rem, fontWeight: '500', lineHeight: '1.2' }
  input: { fontFamily: Inter, fontSize: 1rem, fontWeight: '400', lineHeight: '1.4' }
rounded:
  none: '0'
  sm: 2px
  DEFAULT: 2px
  md: 4px
  lg: 6px
  full: 9999px
spacing:
  # Échelle Tailwind par défaut (pas de 4 px) + extensions de tailwind.config.ts.
  '1': 0.25rem
  '2': 0.5rem
  '3': 0.75rem
  '4': 1rem
  '6': 1.5rem
  '8': 2rem
  '12': 3rem
  '18': 4.5rem
  '22': 5.5rem
  '30': 7.5rem
  gutter-mobile: 1rem
  touch-target: 2.75rem
components:
  site-header: { backgroundColor: '{colors.background}', borderBottom: '1px solid {colors.neutral-200}', brandTypography: '{typography.heading-sm}', linkTypography: '{typography.body-sm}', textColor: '{colors.foreground}' }
  button-primary: { backgroundColor: '{colors.foreground}', textColor: '{colors.white}', subTextColor: '{colors.neutral-200}', typography: '{typography.button}', subTypography: '{typography.caption}', rounded: '{rounded.DEFAULT}', minHeight: '{spacing.touch-target}' }
  button-secondary: { backgroundColor: '{colors.white}', textColor: '{colors.foreground}', border: '1px solid {colors.foreground}', typography: '{typography.button}', rounded: '{rounded.DEFAULT}', minHeight: '{spacing.touch-target}' }
  button-disabled: { backgroundColor: '{colors.neutral-200}', textColor: '{colors.neutral-600}', border: '1.5px dashed {colors.neutral-500}', typography: '{typography.button}', rounded: '{rounded.DEFAULT}' }
  whatsapp-button: { base: '{components.button-primary}', subText: 'délai de réponse annoncé' }
  link: { textColor: '{colors.foreground}', textDecoration: 'underline', underlineOffset: 3px }
  action-bar: { backgroundColor: '{colors.white}', borderTop: '1px solid {colors.neutral-300}', padding: '{spacing.3}', gap: '{spacing.2}' }
  tile-row: { columns: 3, gap: 6px, tileBackground: '{colors.white}', tileBorder: '1px solid {colors.neutral-300}', tileAccent: '2px solid {colors.gold}', labelTypography: '{typography.label-caps}', labelColor: '{colors.neutral-600}', valueTypography: '{typography.body-strong}', subTypography: '{typography.caption}', subColor: '{colors.neutral-600}', rounded: '{rounded.DEFAULT}' }
  disclosure: { divider: '1px solid {colors.neutral-300}', titleTypography: '{typography.heading-sm}', indicatorColor: '{colors.neutral-600}', paddingBlock: 14px }
  photo-carousel: { dotSize: 6px, dotColor: '{colors.neutral-300}', dotActiveColor: '{colors.foreground}', dotRounded: '{rounded.full}', counterTypography: '{typography.caption}', counterColor: '{colors.neutral-600}' }
  availability-label: { textColor: '{colors.neutral-600}', typography: '{typography.body-sm}', dot: '8px {colors.foreground}', dotRounded: '{rounded.full}' }
  status-badge: { backgroundColor: '{colors.white}', textColor: '{colors.foreground}', border: '1px solid {colors.neutral-500}', typography: '{typography.caption}', rounded: '{rounded.DEFAULT}', paddingInline: 7px }
  status-badge-publiee: { backgroundColor: '{colors.foreground}', textColor: '{colors.white}', border: '1px solid {colors.foreground}' }
  status-badge-en-curation: { border: '1.5px dashed {colors.foreground}' }
  status-badge-brouillon: { border: '1px dotted {colors.neutral-500}', textColor: '{colors.neutral-600}' }
  status-badge-vendue: { border: '1px solid {colors.foreground}', fontWeight: '600' }
  status-badge-retiree: { textColor: '{colors.neutral-600}', textDecoration: 'line-through' }
  filter-chip: { backgroundColor: '{colors.white}', textColor: '{colors.foreground}', border: '1px solid {colors.foreground}', removeGlyphColor: '{colors.neutral-600}', typography: '{typography.body-sm}', rounded: '{rounded.DEFAULT}', minHeight: '{spacing.touch-target}' }
  unit-toggle: { border: '1px solid {colors.foreground}', offBackground: '{colors.white}', onBackground: '{colors.foreground}', onText: '{colors.white}', rounded: '{rounded.DEFAULT}' }
  artwork-card: { titleTypography: '{typography.heading-sm}', metaTypography: '{typography.caption}', metaColor: '{colors.neutral-600}', priceTypography: '{typography.body-strong}', imageRounded: '{rounded.DEFAULT}' }
  order-card: { backgroundColor: '{colors.white}', border: '1px solid {colors.neutral-300}', accent: '2px solid {colors.gold}', titleTypography: '{typography.heading-sm}', separator: '1px solid {colors.neutral-200}', rounded: '{rounded.DEFAULT}', padding: 14px }
  total-row: { borderTop: '1px solid {colors.foreground}', labelTypography: '{typography.heading-sm}', amountTypography: '{typography.price-lg}' }
  unavailable-line: { backgroundColor: '{colors.background}', border: '1.5px dashed {colors.neutral-500}', titleColor: '{colors.neutral-600}', titleDecoration: 'line-through', rounded: '{rounded.DEFAULT}' }
  info-banner: { backgroundColor: '{colors.white}', border: '1px solid {colors.neutral-300}', accent: '3px solid {colors.gold}', typography: '{typography.body-sm}', textColor: '{colors.foreground}', rounded: '{rounded.DEFAULT}' }
  form-field: { labelTypography: '{typography.body-sm}', labelWeight: '500', inputBackground: '{colors.white}', inputBorder: '1px solid {colors.neutral-500}', inputTypography: '{typography.input}', inputMinHeight: '{spacing.touch-target}', hintTypography: '{typography.caption}', hintColor: '{colors.neutral-600}', missingBorder: '1.5px dashed {colors.foreground}', missingTextWeight: '600', rounded: '{rounded.DEFAULT}' }
  photo-slot: { backgroundColor: '{colors.white}', border: '1px solid {colors.neutral-300}', missingBorder: '1.5px dashed {colors.foreground}', optionalBorder: '1.5px dashed {colors.neutral-500}', rounded: '{rounded.DEFAULT}' }
  neutral-zone: { border: '1.5px dashed {colors.neutral-500}', hatch: 'repeating-linear-gradient(45deg, {colors.neutral-200} 0 8px, {colors.neutral-100} 8px 16px)', labelBackground: '{colors.white}', labelBorder: '1px solid {colors.neutral-300}', labelTypography: '{typography.body-sm}', rounded: '{rounded.DEFAULT}' }
  status-timeline: { doneDot: '{colors.foreground}', currentDot: '2px solid {colors.foreground}', todoDot: '1.5px solid {colors.neutral-500}', rail: '1px solid {colors.neutral-300}', doneText: '{colors.foreground}', todoText: '{colors.neutral-600}', dotRounded: '{rounded.full}' }
  confirm-sheet: { backgroundColor: '{colors.white}', borderTop: '2px solid {colors.foreground}', titleTypography: '{typography.heading-sm}', padding: '{spacing.4}' }
  availability-picker: { backgroundColor: '{colors.white}', border: '1px solid {colors.foreground}', selectedWeight: '600', typography: '{typography.body-sm}', rounded: '{rounded.DEFAULT}' }
  artist-tabbar: { backgroundColor: '{colors.white}', borderTop: '1px solid {colors.neutral-300}', textColor: '{colors.neutral-600}', activeText: '{colors.foreground}', activeIndicator: '2px solid {colors.foreground}', typography: '{typography.caption}' }
  count-badge: { backgroundColor: '{colors.foreground}', textColor: '{colors.white}', typography: '{typography.caption}', rounded: '{rounded.DEFAULT}', minSize: 20px }
  ornament-rule: { border: '1px solid {colors.gold}', width: 40px }
---

## Identité et style (Brand & Style)

Errancy se présente comme une galerie, pas comme une boutique. La base visuelle existe déjà dans le code (`tailwind.config.ts`) : un blanc cassé chaud, un noir profond, un or discret, la serif Cormorant Garamond pour les titres et Inter pour tout le reste, des coins presque droits. Cette base est **conservée et affinée** (décision 1a du memlog) : on ne change pas d’identité, on corrige ce qui gênait la lecture et l’accessibilité, surtout le rôle de l’or et les gris trop pâles.

L’attitude est celle d’un cartel de musée tenu par quelqu’un de chaleureux : sobre, précis, aucun effet de vitrine. L’œuvre occupe la place ; l’interface se tait. La confiance vient de l’exactitude des chiffres (prix livré, délai, dimensions en deux unités) et non d’une décoration rassurante. Aucune référence externe n’est à imiter ; l’anti-référence est la boutique de décoration à promotions, compte à rebours et fausse rareté.

## Couleurs (Colors)

Toutes les valeurs viennent de `tailwind.config.ts`. Aucune couleur n’est ajoutée ; seul `{colors.white}` provient de la palette par défaut de Tailwind, déjà présente et utilisée par les maquettes pour les surfaces posées (cartes, barre d’actions, champs).

| Jeton | Rôle | Interdit |
|---|---|---|
| `{colors.background}` | Fond de toutes les pages | — |
| `{colors.foreground}` | Texte courant, titres, action principale (fond), focus, états affirmés | — |
| `{colors.white}` | Surfaces posées : cartes, cases, barre d’actions, champs, bandeaux | Fond de page |
| `{colors.neutral-600}` | Texte secondaire : libellés, métadonnées, indications | — |
| `{colors.neutral-500}` | Texte tertiaire sur `{colors.background}` ou `{colors.white}` ; bordure des champs | Texte sur `{colors.neutral-200}` (4,37:1) |
| `{colors.neutral-300}` / `{colors.neutral-200}` | Filets, bordures de cartes, séparateurs, fonds de vignettes en chargement | Texte |
| `{colors.neutral-400}` | Aucun usage textuel (2,29:1) | Tout texte, toute icône porteuse de sens |
| `{colors.gold}` et variantes | Ornement : filet `{components.ornament-rule}`, liseré haut des cases et cartes, trait gauche des bandeaux, contour décoratif des signes de sérieux | Texte, fond de bouton, focus, indication d’état |

**L’or est décoratif, uniquement.** Mesuré sur `{colors.background}`, `{colors.gold}` donne 2,19:1 et `{colors.gold-dark}` 3,26:1 : illisibles pour du texte en AA. Il ne porte donc jamais une information ; s’il disparaît, rien ne se perd. Le noir sur fond or (8,66:1) est techniquement lisible, mais un fond or plein reste exclu pour garder l’or rare.

**Contrastes de référence** (mesurés, AA texte courant = 4,5:1) :

| Paire | Ratio | Usage |
|---|---|---|
| `{colors.foreground}` sur `{colors.background}` | 18,94:1 | Texte courant |
| `{colors.white}` sur `{colors.foreground}` | 19,8:1 | Libellé du bouton principal |
| `{colors.neutral-200}` sur `{colors.foreground}` | 16,12:1 | Sous-ligne du bouton principal (délai WhatsApp, total) |
| `{colors.neutral-600}` sur `{colors.background}` / `{colors.white}` | 8,53:1 / 8,91:1 | Texte secondaire |
| `{colors.neutral-600}` sur `{colors.neutral-200}` | 7,25:1 | Bouton indisponible |
| `{colors.neutral-500}` sur `{colors.background}` / `{colors.white}` | 5,13:1 / 5,36:1 | Gris le plus clair autorisé pour du texte |
| `{colors.neutral-500}` sur `{colors.neutral-200}` | 4,37:1 | **Interdit** pour du texte |
| `{colors.gold}` / `{colors.gold-dark}` / `{colors.neutral-400}` sur `{colors.background}` | 2,19 / 3,26 / 2,29:1 | **Interdits** pour du texte |

**Pas de couleurs d’état.** Aucun rouge d’alerte, aucun vert de succès, aucun orange d’avertissement : les états se lisent par leur **libellé**, renforcé par la graisse, le style de bordure (plein, tirets, pointillés) ou le barré. La palette ne contient aucun jeton d’état ; ce choix est assumé, mais il est reposé en question ouverte (EXPERIENCE.md, UXQ-6) au cas où un besoin réglementaire ou d’accessibilité l’exigerait.

**Pas de mode sombre** `[ASSUMPTION]` (délégué par le porteur). Les jetons n’ont donc pas de paire sombre.

## Typographie (Typography)

- **Cormorant Garamond** (600) porte la voix de la galerie : titres d’œuvres, titres de sections, questions de la fiche, titres de cartes commande. Échelle `display-*` existante de `tailwind.config.ts`, inchangée, plus `{typography.heading-sm}` (1,25 rem, correspond à `text-xl`) pour les titres de sections et de cartes.
- **Inter** porte tout ce qui sert à décider : prix, dimensions, délais, libellés, formulaires, boutons.
- Sur mobile, le titre de la fiche œuvre est en `{typography.display-sm}` ; le titre d’un écran de service (panier, espace artiste) en `{typography.display-xs}`. Les tailles `display-lg` et au-delà sont réservées à l’accueil sur grand écran.
- Texte courant en `{typography.body-md}` (16 px). Les champs de saisie sont en `{typography.input}` (16 px minimum) pour éviter le zoom automatique des navigateurs mobiles ; les maquettes en 14 px sont corrigées ici.
- Plus petite taille admise : 12 px (`{typography.caption}`, `{typography.label-caps}`). Les annotations en 11 px des maquettes sont des notes de maquette, pas du produit.
- Les libellés de cases (Taille, Prix livré, Délai) sont en `{typography.label-caps}` : capitales espacées, `{colors.neutral-600}`.
- Les chiffres se composent avec espace fine insécable : « 1 450 € », « 61 × 76 cm », « 15 h 42 ».
- L’histoire courte d’une œuvre est limitée à environ 65 caractères par ligne sur grand écran.

## Mise en page et espacement (Layout & Spacing)

- Échelle Tailwind par pas de 4 px (`{spacing.1}` à `{spacing.12}`), plus les extensions existantes `{spacing.18}`, `{spacing.22}`, `{spacing.30}` pour les respirations éditoriales de l’accueil sur grand écran.
- **Mobile d’abord**, largeur de référence 375 px, marge latérale `{spacing.gutter-mobile}`. Une colonne. Points de rupture Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) ; comportements détaillés dans EXPERIENCE.md, section Responsive.
- La première photo de la fiche (mise en situation) occupe toute la largeur, sans marge ni coin arrondi ; tout le reste respecte la marge.
- Rythme vertical : `{spacing.4}` entre blocs d’une même section, `{spacing.6}` entre sections ; les cartes commande sont séparées de `{spacing.3}`.
- Cibles tactiles d’au moins `{spacing.touch-target}` (44 px) dans les deux dimensions.
- **Propriétés CSS logiques** partout (`margin-inline-start`, `padding-inline`, `text-align: end`, `inset-inline`) : pas d’arabe au lancement, mais la porte reste ouverte au sens de lecture droite-gauche.

## Élévation et profondeur (Elevation & Depth)

L’interface est **plate** : la profondeur vient du ton (`{colors.white}` posé sur `{colors.background}`) et de filets `{colors.neutral-300}`. Aucune ombre sur les cartes, cases, vignettes ou boutons. Les ombres existantes (`shadow-premium-sm`, `shadow-premium`, `shadow-premium-lg`) restent dans la configuration ; seule `shadow-premium` est admise pour un élément réellement superposé (menu, `{components.confirm-sheet}`). `shadow-gold` n’est pas employée : un halo or sur un élément interactif lui donnerait une valeur d’état.

La barre d’actions fixe se détache par son fond `{colors.white}` et son filet haut, pas par une ombre. Le voile qui assombrit l’écran derrière une feuille de confirmation n’a pas de jeton décidé (question ouverte UXQ-5).

## Formes (Shapes)

Coins à `{rounded.DEFAULT}` (2 px) partout : boutons, champs, cartes, cases, badges, puces, photos. Le quasi-droit évoque le passe-partout et le cartel, pas l’application grand public. `{rounded.full}` est réservé aux pastilles (points du carrousel, point de disponibilité, points de la frise d’états). `{rounded.md}` et `{rounded.lg}` ne servent pas dans le produit (le 6 px des maquettes ne concerne que le cadre de téléphone et l’aperçu d’e-mail).

## Composants (Components)

Spécification visuelle ; le comportement est dans EXPERIENCE.md, Component Patterns, sous les mêmes noms. Illustrations : [mockups/fiche-oeuvre.html](mockups/fiche-oeuvre.html) (barre d’actions, rangée trois cases, sections dépliables, bandeau, filet or), [mockups/parcours-thomas-achat.html](mockups/parcours-thomas-achat.html) (puces de filtre, cartes commande, ligne indisponible, zone neutre de paiement, frise d’états), [mockups/parcours-karim-espace-artiste.html](mockups/parcours-karim-espace-artiste.html) (badges d’état, formulaire de dépôt, feuille de confirmation, navigation basse). Les spines priment sur les maquettes.

| Composant | Anatomie et rendu |
|---|---|
| `{components.site-header}` | Ligne fine : à gauche « ‹ Retour » ou « Menu », au centre la marque ERRANCY en `{typography.heading-sm}` espacé, à droite « Panier (n) » en texte. Aucune icône cœur (favoris hors périmètre). |
| `{components.action-bar}` — barre d’actions fixe | Collée en bas de l’écran mobile, fond `{colors.white}`, filet haut. Première ligne : action principale pleine largeur ; seconde ligne : deux actions secondaires côte à côte. |
| `{components.button-primary}` | Noir plein, texte blanc ; sous-ligne facultative en `{colors.neutral-200}` (délai de réponse, total et nombre de commandes). Une seule par écran. |
| `{components.button-secondary}` | Fond blanc, contour noir 1 px, texte noir. |
| `{components.button-disabled}` | Fond `{colors.neutral-200}`, contour en tirets, texte `{colors.neutral-600}`. Toujours accompagné d’un texte qui dit ce qui manque. |
| `{components.whatsapp-button}` — Conseil WhatsApp | Variante de `{components.button-primary}` (ou secondaire selon l’écran) avec la sous-ligne du délai annoncé. Pas de vert WhatsApp, pas de logo en couleur. |
| `{components.link}` | Noir souligné, décalage 3 px ; jamais or. |
| `{components.tile-row}` — rangée trois cases Taille / Prix livré / Délai | Trois cases égales, fond blanc, filet `{colors.neutral-300}`, liseré haut or 2 px. Libellé en capitales, valeur en `{typography.body-strong}`, sous-ligne en `{typography.caption}` (unité secondaire, orientation et format ; pays et lien « Modifier » ; « Livrée chez vous »). Sous la rangée, la mention des droits et taxes en `{typography.caption}`. |
| `{components.disclosure}` — section dépliable | Titre-question en `{typography.heading-sm}`, indicateur « + / − » en Inter à droite, filets haut et bas. Contenu en liste clé-valeur (`dt` en `{colors.neutral-600}`, `dd` en noir), total en gras. |
| `{components.photo-carousel}` | Photo pleine largeur ; points de position 6 px ; compteur « 1/4 » et légende de la prise de vue en `{typography.caption}`. |
| `{components.availability-label}` | Point plein 8 px + libellé (« Disponible », « Réservée », « Vendue ») ; le libellé porte le sens. |
| `{components.status-badge}` — badge d’état d’œuvre | Étiquette rectangulaire 2 px. Variantes par style de trait, toujours avec libellé : Publiée (plein noir, texte blanc), En curation (tirets noirs), Brouillon (pointillés, texte gris), Réservée et Vendue ailleurs (contour gris), Vendue (contour noir, gras), Retirée (texte gris barré). Sert aussi aux états de commande (contour gris, fond `{colors.background}`). |
| `{components.filter-chip}` — puce de filtre | Contour noir, fond blanc, libellé + « × » gris. Hauteur de cible 44 px même si le dessin est plus fin. |
| `{components.unit-toggle}` | Contrôle segmenté « cm / in » : segment actif noir plein, inactif blanc. |
| `{components.artwork-card}` | Image au ratio de l’œuvre, titre serif, ligne « Artiste · dimensions », prix livré en gras + « livrée », délai. Aucun prix barré, aucune étiquette promotionnelle. |
| `{components.order-card}` — carte commande par artiste | Fond blanc, filet gris, liseré haut or. Titre « Commande n · Artiste (ville) », vignette 72 px + titre d’œuvre, lignes Œuvre / Livraison / Sous-total alignées à droite, puis délai et « Expédiée séparément par l’artiste, depuis… ». |
| `{components.total-row}` | Filet noir 1 px au-dessus ; « Total général » en serif, montant en `{typography.price-lg}`. |
| `{components.unavailable-line}` | Encadré en tirets gris sur fond de page ; titre barré en gris ; phrase factuelle ; trois vignettes d’œuvres proches. Aucune couleur. |
| `{components.info-banner}` — bandeau d’information | Fond blanc, filet gris, trait gauche or 3 px (`border-inline-start`), texte noir ; première phrase en gras quand elle porte le fait. |
| `{components.form-field}` — champ de formulaire | Libellé toujours visible au-dessus (jamais seulement un texte indicatif), champ blanc à bordure `{colors.neutral-500}` (5,13:1, conforme au contraste des composants), indication en dessous. Champ obligatoire manquant : bordure en tirets noirs et message en gras préfixé « À compléter · ». |
| `{components.photo-slot}` | Case photo du dépôt : remplie (vignette + « Remplacer »), obligatoire manquante (tirets noirs, « + Ajouter »), facultative (tirets gris). |
| `{components.neutral-zone}` — zone neutre hachurée | Hachures diagonales `{colors.neutral-200}` / `{colors.neutral-100}`, contour en tirets, étiquette blanche centrée qui nomme ce qui n’est pas décidé. Sert au paiement, au moyen de versement et à l’adresse masquée. Les maquettes utilisent `#F1F1EE` pour la seconde hachure : remplacé ici par `{colors.neutral-100}`. |
| `{components.status-timeline}` — frise d’états | Liste verticale ; étape faite = point noir plein, étape en cours = anneau noir 2 px et texte gras, étape à venir = anneau gris et texte gris ; date sous chaque étape. |
| `{components.confirm-sheet}` | Feuille en bas d’écran, filet haut noir 2 px, titre serif, phrase de conséquence, « Annuler » (secondaire) et « Confirmer » (principal) côte à côte. |
| `{components.availability-picker}` | Liste déroulante sur la ligne de l’œuvre : valeur courante en tête, options en dessous, option choisie en gras précédée d’un point. |
| `{components.artist-tabbar}` | Navigation basse de l’espace artiste, quatre onglets texte (Accueil, Œuvres, Commandes, Paiements) ; onglet courant en noir gras avec trait haut 2 px. |
| `{components.count-badge}` | Petit compteur noir à texte blanc accolé à un titre (« À expédier 1 »). |
| `{components.ornament-rule}` | Filet or de 40 px sous un titre éditorial. Purement décoratif, `aria-hidden`. |

## À faire et à éviter (Do’s and Don’ts)

| À faire | À éviter |
|---|---|
| Action principale en noir plein, une seule par écran | Bouton à fond or, texte or, lien or |
| Or en filets, liserés et ornements que l’on peut retirer sans perte | Or comme indicateur d’état, de sélection ou de focus |
| Texte en `{colors.neutral-500}` au plus clair, sur fond clair | `{colors.neutral-400}` ou plus clair pour du texte ; `{colors.neutral-500}` sur `{colors.neutral-200}` |
| États lus par libellé, renforcés par trait, graisse ou barré | État signalé par la couleur seule ; rouge, vert ou orange d’alerte |
| Échéance donnée en heure fixe (« jusqu’à 15 h 42 ») | Compte à rebours, barre de temps qui se vide, « plus que 2 » |
| Coins à 2 px partout | Pilules, cartes très arrondies |
| Interface plate, profondeur par le ton | Ombres sur les cartes, halo or |
| Animations sobres de l’existant (`fade-in` 400 ms, `scale-in` 450 ms, courbe `premium`), coupées sous `prefers-reduced-motion` | Parallaxe, carrousel automatique, rebonds, animation au défilement |
| Propriétés CSS logiques (`inline-start` / `inline-end`) | `left` / `right` codés en dur dans la mise en page |
| Champs à 16 px, libellés visibles | Texte indicatif servant de libellé |
| Emplacement neutre hachuré pour ce qui n’est pas décidé | Logo ou formulaire d’un prestataire de paiement tant qu’OQ-1 est ouverte |
