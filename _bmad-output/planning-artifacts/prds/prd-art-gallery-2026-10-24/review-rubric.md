# Revue qualité du PRD — Refonte d'Errancy (prd-art-gallery-2026-10-24)

*Revue selon `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`. Documents lus : `prd.md`, `addendum.md`. Comme demandé, le fait que le montage de paiement ne soit pas tranché (OQ-1) n'est pas compté comme un défaut. Ce qui est relevé, ce sont les exigences qui supposent sans le dire un montage précis. Les renvois aux sources ont été vérifiés : `docs/decisions-porteur.md` l.17 et l.73-74, `docs/strategie-refonte.md` l.81 et l.148 sont exacts.*

## Overall verdict

Le PRD a une thèse nette (« lever ses doutes est le premier levier de vente »), un glossaire solide, des questions ouvertes bien tenues (chacune dit ce qu'elle bloque) et des garde-fous qui équilibrent vraiment les indicateurs. Il est utilisable pour l'UX et l'architecture. Trois points le fragilisent :
- le découpage en lots n'est pas cohérent : le Lot 1, présenté comme « indépendant », s'appuie sur des FR rangées dans le Lot 2 ;
- la phrase « les exigences ci-dessous valent quel que soit ce montage » (§4.3) est fausse pour FR-12 et FR-13, qui supposent un paiement en ligne intégré avec notification serveur ;
- le cycle de vie de la commande après l'expédition (livraison, retour, remboursement) n'a aucune FR, alors que SM-1 et UJ-3 en dépendent.

Ces trois points se corrigent sans attendre OQ-1.

## Decision-readiness — adequate

Les questions ouvertes de §9 sont de vraies questions. Chacune indique ce qu'elle bloque (« Bloquant pour : »), qui décide, et où en est l'étude. La tension principale est nommée franchement en OQ-1 : « l'étude propose une "galerie qui encaisse, puis reverse", alors que le porteur a posé Errancy en intermédiaire ». §7 et §0 disent clairement ce que le PRD ne tranche pas. Un décideur sait ce qu'il doit arbitrer.

En revanche, le PRD affirme à tort que certaines parties peuvent avancer sans le montage. Il présente aussi comme acquises des réponses à des questions encore ouvertes chez le porteur. Un décideur qui lit §4.3 et §6.1 croira qu'une partie du travail est débloquée alors qu'elle ne l'est pas.

### Findings
- **[high]** Fausse indépendance vis-à-vis du montage de paiement (§4.3 description, FR-12, FR-13, FR-14) — Le PRD affirme : « Les exigences ci-dessous valent quel que soit ce montage » et « Quel que soit le montage, FR-11, FR-12 et FR-13 s'appliquent ». Or :
  - FR-13 exige une « confirmation du paiement par le prestataire, reçue côté serveur » avec « idempotence, comme dans le webhook actuel ». C'est le modèle Stripe Checkout + webhook ;
  - FR-12 suppose que « l'acheteur lance le paiement » depuis le site, ce qui ouvre une réservation automatique d'environ 30 min.

  Avec l'option R4 (lien de paiement après un conseil WhatsApp, addendum §B), un virement ou un prestataire sans webhook, aucune notification serveur n'arrive, et la réservation dure le temps de la conversation, pas 30 min. Ces FR reposent donc sur un montage « paiement intégré avec notification ». *Fix :* formuler FR-12 et FR-13 selon le résultat attendu (« une commande n'est `confirmée` qu'après une preuve de paiement vérifiable, enregistrée une seule fois ; l'œuvre est bloquée de la décision d'achat jusqu'à cette preuve »). Déplacer « webhook » et « durée ~30 min » dans une variante « paiement intégré ». Ajouter une variante « paiement assisté » (confirmation manuelle par l'équipe dans FR-26), qui sert aussi OQ-12.
- **[medium]** Panier multi-artistes sans lien avec OQ-1 (Glossaire « Commande : achat confirmé d'une ou plusieurs œuvres » ; FR-10, FR-11) — Une commande peut regrouper des œuvres de plusieurs artistes, donc de plusieurs vendeurs. Encaisser une seule fois puis répartir entre vendeurs est justement ce que règle le montage (Connect, versements, ou une commande par vendeur). Le PRD ne relie pas ce point à OQ-1. *Fix :* ajouter le panier multi-vendeurs à la liste « Bloquant pour » de OQ-1, ou limiter le MVP à une commande par artiste et le marquer `[NON-GOAL for MVP]`.
- **[medium]** Des questions ouvertes chez le porteur sont présentées comme réglées (UJ-4, UJ-1 étape 3, FR-19) —
  - UJ-4 affirme : « Il n'y a pas de showroom : les visites se font à distance, ou en atelier ». Or `docs/decisions-porteur.md` §2 laisse « Showroom… : … » vide, et OQ-8 pose exactement cette question. L'OQ devient rhétorique ;
  - FR-19 suppose que le contenu des pages artistes est « fourni par l'artiste ». Or `docs/strategie-refonte.md` l.81 indique « MVP (gérées par Errancy) ». L'hypothèse contredit la source sans le signaler ;
  - en UJ-1, la devise CAD est marquée `[ASSUMPTION]`, mais elle entre en conflit avec NFR-8 (voir Mechanical notes). *Fix :* écrire UJ-4 sous condition (« si aucun showroom… ») ; dans FR-19, citer la stratégie et marquer l'écart pour OQ-14.
- **[low]** OQ-12 n'est pas présentée comme un arbitrage (§6.1 dernier point, OQ-12) — C'est la décision qui conditionne le plus la date de SM-1. Pourtant elle n'a ni coût ni contrepartie : charge pour l'équipe, aucune mesure de FR-13 dans le tunnel, risque de double vente manuelle. *Fix :* ajouter deux lignes « ce qu'on gagne / ce qu'on perd ».

## Substance over theater — adequate

La vision est propre à Errancy et ne pourrait pas servir à un autre PRD : les quatre questions de l'acheteur, la diaspora, le conseil WhatsApp, l'artiste qui expédie lui-même. Les quatre personnages font chacun naître des FR précises (Yasmine → FR-1 à FR-4, FR-9 ; Karim → FR-20, FR-21 ; Salma → FR-26 ; Thomas → FR-8). Les NFR sont inégales. NFR-2, NFR-4 et NFR-7 sont propres au produit, NFR-4 en particulier (« testé explicitement avant le lancement »). NFR-1, NFR-3 et NFR-5 se lisent comme du gabarit, rattrapé de justesse par des `[ASSUMPTION]` chiffrées.

### Findings
- **[medium]** Différenciation probablement surévaluée (§1 : « Aucun concurrent étudié n'offre ce conseil humain direct ; c'est la différence qu'Errancy peut revendiquer ») — Des places de marché citées dans l'addendum §C proposent des services de conseil humain. Saatchi Art, par exemple, a un service « Art Advisory » gratuit, et Singulart met en avant des conseillers. L'addendum dit plus prudemment « Différenciation possible ». Si la promesse marketing repose sur une affirmation fausse, la thèse s'affaiblit. *Fix :* revérifier dans l'étude concurrentielle et resserrer la formulation sur ce qui est réellement distinctif : WhatsApp, immédiat, avec un délai annoncé, dans la langue de la diaspora.
- **[low]** NFR adjectivales (NFR-1 « se chargent vite », NFR-3 « contrastes suffisants », NFR-5 « Next.js est mis à jour ») — Aucun seuil n'est fixé dans le corps du texte. NFR-5 ne donne ni version cible ni critère (par exemple « aucune vulnérabilité critique connue sur la version déployée »). *Fix :* remonter LCP < 2,5 s et WCAG 2.1 AA dans le texte comme valeurs par défaut révisables ; donner un critère vérifiable pour NFR-5.
- **[low]** SM-5 sert de remplissage (§8) — « Il sert à suivre la marge contributive par œuvre ». La marge ne se calcule pas tant que OQ-3 (assiette de la commission) est ouverte, et SM-5 ne valide aucune FR ni la thèse. *Fix :* le rattacher à une hypothèse (par exemple « le conseil fait monter le panier moyen », à croiser avec SM-3) ou le retirer.

## Strategic coherence — adequate

La thèse est explicite et l'ordre « convertir d'abord » organise bien les fonctionnalités (§4.1 en tête, §4.8 pour mesurer). Les indicateurs valident la thèse : SM-2 et SM-3 mesurent la conversion et l'effet du conseil, et non une simple activité. Les garde-fous SM-C1 à SM-C3 sont de vrais contrepoids : « promettre trop pour convertir se paie en retours ». Le MVP est de type « résolution de problème ».

Le problème vient du découpage en lots (§6.1). C'est le principal levier stratégique du PRD (« pour ne pas faire attendre la conversion derrière le montage de paiement »), et il ne tient pas tel qu'il est écrit.

### Findings
- **[high]** Le Lot 1 dépend de FR rangées dans le Lot 2 (§6.1) — Le Lot 1 contient FR-1 à FR-9, FR-16 à FR-19, FR-27 et FR-28. Or :
  - FR-16 exige des œuvres « publiées après curation », mais la curation (FR-25) et le dépôt (FR-20) sont dans le Lot 2 ;
  - FR-3 et FR-4 calculent prix et délai à partir des zones de livraison déclarées dans FR-20 (Lot 2) ;
  - FR-8 rend la demande « visible dans l'administration (FR-25) » (Lot 2) ;
  - FR-9 ne sert que pour une œuvre `réservée`, état créé par FR-12 (Lot 2) ;
  - FR-28 rattache des commandes, qui n'existent qu'avec FR-13 (Lot 2) ;
  - SM-4, « condition de sortie du Lot 1 », « Valide FR-20 », qui est dans le Lot 2 ;
  - FR-6 affiche « Acheter » dans le Lot 1, sans panier ni commande.

  Aucune de ces dépendances ne touche au paiement : FR-20, FR-21 et FR-25 pourraient passer dans le Lot 1. *Fix :* mettre FR-20, FR-21, FR-25 et la partie « réservations » de FR-26 dans le Lot 1. Dire ce que fait « Acheter » dans le Lot 1 (masqué, ou redirigé vers le conseil selon OQ-12). Déplacer FR-28 et FR-9 dans le Lot 2, ou préciser leur forme réduite dans le Lot 1.
- **[medium]** L'objectif de SM-1 n'est pas atteignable sans arbitrage (§8 SM-1 ; OQ-1, OQ-11, OQ-12) — « dans les 12 semaines… avant la fin de la phase 4 » suppose que FR-14 soit livrée ou que l'option OQ-12 soit retenue. Or FR-14 attend un avis juridique dont on ne connaît pas la date. Le PRD ne relie pas l'objectif à cette dépendance. *Fix :* écrire « 12 semaines après la réponse à OQ-1 ou la décision OQ-12 », ou indiquer explicitement la condition.

## Done-ness clarity — adequate

La plupart des FR ont au moins une conséquence testable, et plusieurs sont exemplaires :
- FR-3 : « Le prix total affiché est égal au montant demandé au paiement, pour un même pays » ;
- FR-12 : un seul gagnant en cas de paiements simultanés ;
- FR-13 : idempotence ;
- FR-20 : impossible de soumettre une œuvre incomplète.

La faiblesse est un trou dans le cycle de vie de la commande, que les indicateurs et les parcours supposent pourtant réglé. Il y a aussi quelques formules non bornées.

### Findings
- **[high]** Pas de FR pour la livraison, le retour, la clôture et le remboursement (Glossaire « Commande », UJ-3 Résolution, UJ-2 Cas limite, SM-1, FR-26) — Le glossaire définit les états `livrée`, `close`, `annulée` et `retournée`. Mais seul `expédiée` a un déclencheur, dans FR-22. On ne sait pas qui ou quoi fait passer une commande à `livrée`, alors que UJ-3 dit que cela « ouvre le délai de retour de 14 jours » et que SM-1 exige une commande « passée au-delà du délai de retour sans litige ». Aucune FR ne couvre une demande de retour ni un remboursement : FR-26 permet d'« annuler une commande en indiquant un motif », sans dire si l'acheteur est remboursé. Le remboursement dépend en partie du montage, mais l'état de la commande et la décision n'en dépendent pas. *Fix :* ajouter une FR sur les transitions (`livrée` par l'équipe, ou automatiquement via le suivi du transporteur ; `close` à livrée + 14 j sans retour ; `retournée` et `annulée` avec motif). Ajouter une FR « demande de retour » côté acheteur. Laisser seulement l'exécution du remboursement en attente de OQ-1.
- **[medium]** Formules non bornées —
  - FR-21 « visible sur le site immédiatement » : quel délai maximal, compte tenu du cache et de l'ISR ?
  - FR-6 « sans faire défiler l'écran sur mobile » : sur quel écran de référence (par exemple 375×667) ?
  - FR-12 « pour une durée limitée » : que se passe-t-il pour un panier dont une seule œuvre est déjà réservée ?
  - FR-9 : à quel moment l'e-mail part-il ? Que se passe-t-il si l'œuvre est vendue entre-temps ?

  *Fix :* donner un seuil ou une règle pour chacun.
- **[medium]** FR-17 et FR-1 s'appuient sur des données que personne ne saisit (FR-17, FR-20) — FR-17 filtre par « couleur dominante » et par « format », mais FR-20 ne demande ni l'une ni l'autre à l'artiste, et « format » n'est pas défini (taille ? classes S/M/L ?). FR-1 affiche l'« orientation » (déductible des dimensions, à préciser). FR-5 annonce le certificat, mais FR-20 ne demande pas à l'artiste de s'engager à le fournir. *Fix :* ajouter ces champs à FR-20, ou dire comment ils sont calculés ; définir « format » dans le glossaire.
- **[low]** FR-25 et FR-28 n'ont aucun critère vérifiable — Pour FR-25 : l'artiste est-il prévenu du renvoi et voit-il le commentaire ? Pour FR-28 : le rattachement est-il manuel, et sur quel élément du conseil WhatsApp (il n'en existe aucun enregistrement côté site) ? *Fix :* ajouter une conséquence testable à chacune.

## Scope honesty — adequate

C'est un des points forts du document. §6.2 (hors MVP, avec justification pour le simulateur), §7 (« Ce que la refonte n'est pas ») et §2.2 font un vrai travail d'exclusion. Les `[ASSUMPTION]` sont signalées et indexées, et les dépendances aux OQ sont annoncées dans chaque FR concernée (FR-5, FR-14, FR-23, FR-24). Il y a 15 OQ et 14 `[ASSUMPTION]`, ce qui est beaucoup pour un brouillon. Mais le PRD dit honnêtement lesquelles bloquent l'UX ou l'architecture (aucune pour OQ-7, OQ-10 et OQ-11, « pas pour l'UX ni l'architecture »). La quantité est donc supportable pour cette étape, pas pour un feu vert de développement. Il n'y a aucun `[NOTE FOR PM]`. La « Tension à arbitrer » de OQ-1 joue ce rôle.

### Findings
- **[medium]** Des obligations propres aux places de marché manquent (§10) — §10 couvre la rétractation, le RGPD, le statut d'intermédiaire et le droit d'auteur. Il ne dit rien de deux points :
  - l'obligation d'indiquer à l'acheteur si le vendeur est un professionnel ou un particulier, imposée aux places de marché dans l'UE. Le droit de rétractation de 14 jours en dépend : il ne s'applique pas si l'artiste vend comme particulier ;
  - les obligations de déclaration des ventes réalisées par les vendeurs tiers.

  Elles dépendent du pays de l'exploitant (OQ-1). Il ne faut donc rien trancher, mais l'omission devrait être dite. *Fix :* ajouter une ligne « relève de OQ-1 et de l'avis juridique » à côté du contrôle des changes, et transformer FR-23 « pour les acheteurs concernés » en dépendance explicite.
- **[low]** OQ-4 suppose que les fonds sont conservés (OQ-4 : « Quand l'artiste est-il payé : à la livraison, ou à la livraison plus 14 jours ? ») — La question suppose qu'Errancy garde l'argent avant de le reverser, c'est-à-dire le montage recommandé par l'étude. C'est justement ce que OQ-1 met en tension avec le statut d'intermédiaire. *Fix :* reformuler (« à quel moment l'artiste reçoit-il sa part, et qui la garde entre-temps ? ») et renvoyer à OQ-1.

## Downstream usability — strong

Le glossaire est complet et couvre les termes qui posent problème : `Prix total`, `Délai total`, les quatre états de `Disponibilité`, `Montage de paiement`. Les numéros sont continus et uniques : FR-1 à FR-28, UJ-1 à UJ-4, NFR-1 à NFR-8, SM-1 à SM-5, SM-C1 à SM-C3, OQ-1 à OQ-15. Tous les renvois internes vérifiés existent (FR-5 → FR-24, FR-2 → NFR-1, FR-8 → FR-25, FR-27 → NFR-6). L'addendum §A donne une correspondance FR → code utile à `bmad-architecture`. Elle a été vérifiée sur deux points : `src/app/galerie/[id]` existe et `/panier` figure bien dans `PROTECTED` de `src/middleware.ts`. Chaque FR peut se lire seule.

### Findings
- **[low]** Même mot pour deux notions (Glossaire « Réservation » ; FR-6, UJ-4 « Réserver une visite ») — La « Réservation » est le blocage pendant le paiement, alors que « Réserver une visite » envoie une « Demande de visite ». Les stories et l'analytique risquent de confondre les deux (FR-27 compte les deux événements). *Fix :* renommer le bouton (« Demander une visite ») ou noter la différence dans le glossaire.
- **[low]** Renvois aux sources par numéro de ligne (`decisions-porteur.md` l.17, l.73-74 ; `strategie-refonte.md` l.81, l.148) — Ils sont exacts aujourd'hui, mais deviendront faux à la première modification de ces fichiers. *Fix :* renvoyer à des titres de section.

## Shape fit — strong

Le produit est une place de marché grand public avec trois parties (acheteur, artiste, équipe), un existant à faire évoluer, et le PRD alimente l'UX, l'architecture puis les stories. La forme convient. Les parcours avec personnages nommés portent le document. L'existant est distingué du nouveau (FR-10 « C'est un changement : aujourd'hui, le panier exige une session » ; FR-11 « doit être conservée »). Le détail technique est placé dans l'addendum. Le document n'est ni trop formel ni pas assez. Seul UJ-3 (Salma) a moins de contexte que les autres (pas de profil ni de point de départ), ce qui est acceptable pour un rôle interne.

## Mechanical notes

- **Devise :** en UJ-1, Yasmine voit le prix « en dollars canadiens ». Or NFR-8 et §6.2 excluent le multidevise du MVP, et OQ-6 part de « français et euro ». FR-3 (« égal au montant demandé au paiement ») suppose en plus que la devise affichée et la devise encaissée sont les mêmes, ce qui dépend de OQ-1 et OQ-6. Il faut aligner UJ-1 sur l'euro, ou indiquer que l'affichage en devise locale est indicatif et que FR-3 s'entend dans la devise encaissée.
- **Index des hypothèses :** chaque `[ASSUMPTION]` du texte se retrouve dans l'index §12, et chaque entrée de l'index existe dans le texte. Seule réserve : l'`[ASSUMPTION : personnage]` d'UJ-3 et le délai de 48 h d'UJ-3 sont regroupés sous « §2.3 » avec ceux de FR-26. C'est acceptable.
- **Glossaire :** `close` est un état de commande qu'aucune FR n'utilise (voir Done-ness). « Format » et « source d'arrivée » (FR-27) ne sont pas définis.
- **Disponibilité :** aucune FR ne dit si une œuvre `retirée` peut revenir à `disponible`, ni par qui.
- **Sections requises :** toutes sont présentes pour ce niveau d'enjeu (vision, utilisateurs, glossaire, FR, NFR, périmètre, indicateurs, OQ, conformité, risques, index).
