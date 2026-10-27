---
id: SPEC-art-gallery
companions:
  - capability-map.md
  - ../../planning-artifacts/prds/prd-art-gallery-2026-10-24/prd.md
  - ../../planning-artifacts/prds/prd-art-gallery-2026-10-24/addendum.md
  - ../../planning-artifacts/ux-designs/ux-art-gallery-2026-10-26/EXPERIENCE.md
  - ../../planning-artifacts/ux-designs/ux-art-gallery-2026-10-26/DESIGN.md
  - ../../planning-artifacts/architecture/architecture-art-gallery-2026-10-27/ARCHITECTURE-SPINE.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Errancy — refonte de la place de marché d'art (Lots 1 et 2)

Rôle des companions : `prd.md` détaille chaque FR et ses conséquences testables, ainsi que le glossaire (§3), qui fait foi ; `addendum.md` fait la correspondance avec le code ; `EXPERIENCE.md` fixe le comportement de l'interface et `DESIGN.md` son apparence ; `ARCHITECTURE-SPINE.md` fixe les règles AD-1 à AD-24 ; `capability-map.md` relie chaque CAP à ses FR, AD, lots et surfaces.

## Why

Personne ne peut acheter sur Errancy aujourd'hui : le site est en maintenance et son catalogue n'est qu'une démonstration. Le porteur veut un **lancement réel**, avec de vrais artistes et de l'argent réel, et une première vente sous environ 12 semaines. Errancy est une place de marché sur sélection : l'artiste, qui peut résider dans n'importe quel pays, vend et expédie lui-même ; Errancy prend 30 % de commission. Les acheteurs visés sont internationaux, d'abord la diaspora. Le pari de la refonte : lever les doutes de l'acheteur sur quatre questions (*Ira-t-elle chez moi ? Est-elle trop petite ? Est-elle trop chère ? Est-ce sérieux ?*), avec un conseil humain par WhatsApp, sans jamais vendre deux fois une œuvre unique. Le montage de paiement attend un avis juridique marocain. Le Lot 1 (conversion et catalogue, sans « Acheter ») doit donc pouvoir sortir sans lui ; le Lot 2 ajoute la commande et l'après-vente.

## Capabilities

**Lot 1 — conversion et catalogue, indépendant du paiement**

- **CAP-1**
  - **intent:** Le visiteur voit sur la fiche œuvre l'échelle, le prix total livré dans son pays, le délai total et les signes de sérieux, avec des actions qui suivent la disponibilité de l'œuvre.
  - **success:** Sur toute fiche publiée : dimensions en cm et en pouces ; photo de mise en situation avec repère d'échelle en première position ; prix total et délai pour le pays choisi, égaux au montant qui sera demandé ; « Acheter » absent tant que le Lot 2 est fermé. Une œuvre vers un pays non livré affiche « Pas de livraison vers [pays] » et propose le Conseil WhatsApp.
- **CAP-2**
  - **intent:** Le visiteur obtient l'avis d'une personne d'Errancy, par WhatsApp ou par une demande de visite ou de sélection, avec un délai de réponse annoncé.
  - **success:** Le bouton WhatsApp est présent sur la fiche, la page artiste, le panier, le suivi et le pied de page, avec un message prérempli par la référence de l'œuvre et le délai affiché. Tant qu'OQ-7 est ouverte, il ouvre le formulaire de repli. Une demande produit un accusé par e-mail et apparaît dans l'administration à l'état `nouvelle`. Les coordonnées de l'artiste ne sont jamais montrées.
- **CAP-3**
  - **intent:** Le visiteur laisse son e-mail sur une œuvre réservée et obtient, à la libération, une priorité pour la commander.
  - **success:** À l'expiration d'une réservation, les inscrits sont prévenus dans l'ordre d'inscription. Le premier dispose d'un délai de priorité pendant lequel personne d'autre ne peut réserver l'œuvre.
- **CAP-4**
  - **intent:** Le visiteur parcourt un catalogue réel, le filtre selon son mur et son budget, et découvre les artistes sélectionnés.
  - **success:** Aucune page publique ne lit de donnée de démonstration. Chaque artiste publié a un accord signé enregistré. Les filtres de FR-17 vivent dans l'URL, et le filtre de prix total donne les mêmes montants que les fiches. L'accueil mène à une fiche en un clic.
- **CAP-5**
  - **intent:** Un artiste sélectionné entre dans son espace par invitation, et n'y voit que ses œuvres et ses commandes.
  - **success:** Le lien d'invitation crée un compte `artist` rattaché à sa fiche, puis expire. Un accès aux œuvres ou commandes d'un autre artiste est refusé côté serveur. Un changement de rôle prend effet sans reconnexion.
- **CAP-6**
  - **intent:** L'artiste dépose une œuvre complète, que l'équipe valide ou renvoie avant toute publication.
  - **success:** L'envoi en curation est impossible tant qu'un champ de FR-20 manque (photos requises, dimensions, au moins une zone avec frais et délais, engagements). L'œuvre n'est publique qu'après validation. Un renvoi porte le commentaire de l'équipe. SM-4 atteint 100 % des œuvres publiées.
- **CAP-7**
  - **intent:** L'artiste retire ou déclare « vendue ailleurs » une œuvre depuis son téléphone, à tout moment.
  - **success:** Dès la confirmation, le serveur refuse toute nouvelle réservation ou commande sur l'œuvre, et le site l'affiche en moins de 60 s. Une réservation en cours est annulée, l'acheteur et l'équipe sont prévenus, et l'incident est compté. « Annuler » n'est proposé que si la déclaration n'a interrompu aucune réservation.
- **CAP-8**
  - **intent:** L'équipe mesure le tunnel de vente et la part des ventes assistées par le conseil, dans le respect du consentement.
  - **success:** Les sept événements de FR-27 portent le slug de l'œuvre et la source d'arrivée, et ne partent qu'après consentement là où la loi l'exige. Le taux de consentement est suivi. Au Lot 2, une commande issue d'une réservation posée par l'équipe est rattachée automatiquement à la vente assistée (FR-28).
- **CAP-9**
  - **intent:** Les visiteurs de la page de maintenance laissent un e-mail et sont prévenus à l'ouverture.
  - **success:** « Me notifier » enregistre l'e-mail avec un consentement explicite et affiche un accusé. La levée de la maintenance par le porteur déclenche l'e-mail d'ouverture.

**Lot 2 — commande et après-vente**

- **CAP-10**
  - **intent:** L'acheteur commande sans compte des œuvres de plusieurs artistes en un seul passage en caisse, et reçoit une commande par artiste.
  - **success:** `/panier` est accessible sans connexion. La commande ne demande que l'e-mail, le nom, l'adresse et le téléphone. Le récapitulatif montre, par artiste, prix, frais, total, délai et colis séparés, avec des montants recalculés côté serveur. Une œuvre devenue indisponible est signalée et retirée sans toucher les autres commandes.
- **CAP-11**
  - **intent:** Une œuvre unique est réservée pour un seul acheteur à la fois, au paiement ou en vente assistée, puis libérée à l'échéance.
  - **success:** Deux tentatives simultanées sur la même œuvre ne donnent qu'une réservation. Un panier est réservé en bloc ou pas du tout. Une réservation expirée est libérée. Chaque réservation est journalisée (qui, quand, échéance, issue), et leur nombre simultané par e-mail ou par appareil est plafonné.
- **CAP-12**
  - **intent:** Une commande est confirmée une seule fois, par le prestataire ou par un constat de l'équipe, sans jamais vendre une œuvre à deux acheteurs.
  - **success:** Une confirmation reçue plusieurs fois, sous plusieurs identifiants, ne crée qu'une commande confirmée. Un paiement arrivé après expiration vend l'œuvre si elle est encore disponible ; sinon, il déclenche un remboursement et un incident SM-C1. L'acheteur reçoit le récapitulatif par e-mail.
- **CAP-13**
  - **intent:** L'acheteur paie le prix total par un moyen accepté à l'international.
  - **success:** Bloqué par OQ-1. Quel que soit l'adaptateur retenu, le montant encaissé égale le total recalculé côté serveur, et la confirmation suit CAP-12.
- **CAP-14**
  - **intent:** L'acheteur suit ses commandes et signale un problème sans compte, grâce à un lien reçu par e-mail.
  - **success:** Le lien porte un jeton impossible à deviner, montre les commandes de son passage en caisse avec un minimum de données personnelles, et devient inactif à la clôture de la dernière commande.
- **CAP-15**
  - **intent:** L'artiste prend en charge chaque commande, puis l'expédie avec un numéro de suivi.
  - **success:** La prise en charge fait passer la commande en `prise_en_charge` et rend l'adresse visible. La saisie du suivi la fait passer en `expediee` et prévient l'acheteur. L'adresse n'est visible par l'artiste qu'entre la prise en charge et la livraison.
- **CAP-16**
  - **intent:** L'équipe mène chaque commande jusqu'à sa clôture : livraison constatée, réclamation, retour, remboursement total ou partiel.
  - **success:** La commande passe en `livree` sur confirmation de l'acheteur, suivi du transporteur ou preuve, et une preuve est exigée au-delà du seuil de prix. Une réclamation est possible depuis le suivi pendant le délai de retour. Un remboursement porte un motif et un état (`demandé`, `effectué`), ne dépasse jamais ce qui a été payé, et l'acheteur est prévenu à chaque changement. La commande se clôt à la fin du délai de retour sans réclamation, ou après le remboursement.
- **CAP-17**
  - **intent:** L'équipe et l'artiste voient, pour chaque commande, la somme due à l'artiste, sa date d'exigibilité et l'état du reversement.
  - **success:** La somme est calculée en un seul endroit, déduction faite des remboursements. Elle devient `à verser` à la clôture, avec un état parmi `à verser`, `versée`, `bloquée`. L'artiste et l'équipe voient le même chiffre.
- **CAP-18**
  - **intent:** L'équipe voit chaque commande, chaque réservation et chaque incident, et peut agir sans toucher à la base.
  - **success:** Une prise en charge manquante après 48 h et une expédition manquante après le délai de préparation sont signalées séparément. L'équipe pose une réservation de vente assistée, confirme une commande, l'annule avec un motif et libère une réservation, chaque action étant tracée.
- **CAP-19**
  - **intent:** Le visiteur consulte des règles claires sur le rôle d'intermédiaire, la livraison, les retours et l'authenticité.
  - **success:** CGV, mentions légales, confidentialité, cookies, livraison, retours et authenticité sont publiées. Fiches et récapitulatif y renvoient. Aucune durée de retour, gratuité ou « Garantie Errancy » n'est affichée tant qu'OQ-2 et OQ-4 sont ouvertes.

**Transverse — avant tout epic fonctionnel**

- **CAP-20**
  - **intent:** Chaque évolution du site est vérifiée automatiquement et peut être annulée sans perte de données.
  - **success:** Next.js reçoit ses correctifs de sécurité (14.2.35, puis 16.x) et Node passe en 24 LTS. Chaque PR passe `eslint .`, le build et les tests. Les trois cas de double vente de NFR-4 sont testés sur un vrai PostgreSQL. L'historique des migrations Prisma correspond à la base réelle. Chaque migration de données se répète et s'annule sur une branche Neon.

## Constraints

- On améliore la pile existante (Next.js App Router, Prisma/Neon, NextAuth v5, Cloudinary, Vercel), sans jamais la remplacer : chaque étape a son retour arrière (NFR-7, AD-20).
- OQ-1 et OQ-16 ne sont pas tranchées : tout encaissement, remboursement ou reversement passe par la frontière de paiement (AD-4), et aucun nom de prestataire n'apparaît hors de ses adaptateurs.
- Aucune double vente : réservation et confirmation sont atomiques et idempotentes (AD-7, AD-8). On ne gagne jamais en conversion en assouplissant la réservation (SM-C1).
- Les montants viennent toujours de la base, jamais du navigateur. Le prix total affiché égale le montant demandé (AD-12).
- Une commande ne concerne qu'un seul artiste. Le panier peut en produire plusieurs (FR-10).
- Errancy est l'intermédiaire, l'artiste est le vendeur et expédie lui-même. Les textes légaux le reflètent (FR-23).
- Les coordonnées de l'acheteur ne sont visibles que par l'équipe, et par l'artiste seulement de la prise en charge à la livraison. Les coordonnées de l'artiste ne sont jamais montrées au visiteur (AD-16).
- La mesure ne part qu'avec consentement là où la loi l'exige, par une seule interface (AD-19).
- La levée de la maintenance et l'ouverture de `robots.txt` sont des actes du porteur, jamais des changements de code. De même, l'ouverture du Lot 2 se fait par un interrupteur côté serveur (AD-17, AD-22).
- Le français pour les textes et les URL, l'euro pour les prix tant qu'OQ-6 est ouverte. Aucune chaîne en dur dans les composants (AD-18).
- Le mobile d'abord. Ni compte à rebours, ni fausse rareté, ni promotions (EXPERIENCE.md).
- Seuls les modules métier accèdent à la base. Chaque donnée a un seul module qui l'écrit (AD-1, AD-2).
- Tout changement d'URL publique a sa redirection 301 (NFR-2).

## Non-goals

- Changement de pile, par exemple vers Supabase, ou refonte en une fois.
- Choix du prestataire de paiement ou de l'entité juridique : il revient au porteur, après l'avis juridique (OQ-1).
- Simulateur mural et visualisation « dans votre pièce ».
- Collections narratives, espace collectionneur (favoris, alertes, suivi d'artistes), `/wishlist`, comparateur de formats.
- Certificat traçable, cadre et cadrage premium, éditions limitées et reproductions.
- Location B2B, sur-mesure, abonnement, journal éditorial.
- Sélecteur de langue ou de devise tant qu'OQ-6 est ouverte.
- Versement automatisé aux artistes, vérification d'identité (KYC) et saisie des coordonnées de versement.
- Prise de rendez-vous en temps réel ; profils distincts au sein de l'équipe.
- Catalogue ouvert à tous les artistes ; galerie qui achète et revend ; boutique de décoration.
- Refonte de `/expositions`, `/dashboard` générique et `/auth/inscription`.

## Success signal

- **SM-1 :** une première commande réelle passe en `close` sans litige, au profit d'un acheteur qui ne figure pas sur la liste des proches déclarée par le porteur.
- **Garde-fou SM-C1 :** aucune double vente, attestée par les tests NFR-4 et par le journal des réservations.
- **Sortie du Lot 1 :** SM-4 atteint 100 %.

## Assumptions

- Réservation d'environ 30 min au paiement et d'environ 48 h en vente assistée ; prise en charge par l'artiste sous 48 h (PRD §13).
- Le pays de livraison est proposé d'office et modifiable ; la France par défaut tant qu'OQ-13 est ouverte.
- « Me prévenir » : ordre d'inscription, avec un délai de priorité réglable.
- Au-delà d'un seuil de prix, à fixer avec OQ-5, l'expédition est assurée avec preuve de livraison.
- LCP < 2,5 s sur mobile en 4G ; WCAG 2.1 AA ; vouvoiement cordial.
- Le délai de réponse WhatsApp affiché tient compte des heures de service.
- Personnages Yasmine, Karim, Salma et Thomas : construits à partir des sources.

## Open Questions

- **OQ-1** Montage de paiement : qui encaisse, avec quel prestataire, et comment l'artiste est payé selon son pays. Bloque CAP-13, le moyen de rembourser (CAP-16) et de verser (CAP-17), et l'identité de l'exploitant (CAP-19).
- **OQ-16** Un paiement pour tout le panier, ou un par commande ? À trancher avec OQ-1 ; l'architecture supporte les deux (AD-4).
- **OQ-2 / OQ-4** Garanties et politique de retour (durée, frais, avoir) : contenu de CAP-19, réclamations et clôture de CAP-16.
- **OQ-3** Assiette de la commission (œuvre seule ou livraison comprise), et qui paie les frais de paiement : calcul de CAP-17. Avant le Lot 2.
- **OQ-5** Zones de livraison, douane, seuil d'assurance. La composition des zones est à fixer avant l'ouverture du Lot 1 (CAP-1, CAP-6) ; le seuil et la page Livraison, avant le Lot 2.
- **OQ-6** Langues et devises supplémentaires, et dans quel lot.
- **OQ-7** Numéro, horaires et délai WhatsApp, avant l'ouverture au public ; repli par formulaire d'ici là.
- **OQ-8** Qui mène la visite, et avec quel délai de confirmation.
- **OQ-10 / OQ-11** Catalogue de lancement, accords signés ; date, budget et ressources.
- **OQ-12** Ouvrir le Lot 1 avec des ventes assistées avant le Lot 2 ? Si oui, CAP-11, CAP-12 et CAP-18 avancent avec le Lot 1.
- **OQ-13** Pays du visiteur : déduit puis proposé, ou choisi dès la première visite ?
- **OQ-14** Part rédigée par l'artiste sur sa page ; Errancy peut-elle corriger une fiche déposée ?
- **OQ-15** Critères de sortie de maintenance.
- **AQ-1** Prestataire d'e-mails transactionnels, avec garanties de transfert UE : avant le premier epic qui envoie un e-mail.
- **AQ-2** Plan Vercel, Hobby ou Pro : Hobby limite les tâches planifiées et exclut l'usage commercial. À trancher avant la livraison de CAP-3.
- **AQ-3** Les préversions Vercel utilisent-elles la base de production ? À vérifier au premier epic qui écrit en base.
- **AQ-4** Plan Neon et fenêtre de restauration : avant la première migration de données.
- **AQ-5** Obligations DSA, DAC7 et export des biens culturels : avis juridique, avec OQ-1.
- **AQ-6** Durée de conservation et purge des données personnelles : avant le Lot 2.
- **UXQ-2 à UXQ-12** Questions propres à l'UX (début des 30 min, état « À revoir », vocabulaire de la somme due, seuils de format, validité de l'invitation, compte après coup, fuseau horaire, pagination…), détaillées dans EXPERIENCE.md.
