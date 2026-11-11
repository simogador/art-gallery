# Epic 6 Context: L'équipe réserve une œuvre pour un acheteur et conclut une vente assistée

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Permettre à l'équipe de réserver une œuvre pour un acheteur identifié, de lui envoyer un lien qui rouvre sa commande, puis de constater le paiement, sans prestataire de paiement intégré (ce qui garde ouverte l'option de vendre en assisté avant le Lot 2, OQ-12, sans la trancher). Aucune œuvre ne doit jamais être vendue deux fois : achat simultané, paiement arrivé après expiration et vente ailleurs pendant une réservation sont les trois cas à prouver par test. L'epic donne aussi son effet à « Me prévenir » (priorité à l'expiration). Préalable à la story 6.7 : déclencheur du balayage (plan Vercel Pro ou déclencheur externe planifié, AQ-2, ouverte).

## Stories

- Story 6.1: Passage en caisse et commandes par artiste, aux montants figés
- Story 6.2: Réservation en bloc sans double vente
- Story 6.3: Vente assistée : réserver pour un acheteur et lui envoyer son lien
- Story 6.4: Paiement constaté par l'équipe et confirmation idempotente
- Story 6.5: Paiement tardif, abandon et incidents
- Story 6.6: Vente ailleurs pendant une réservation
- Story 6.7: Balayage et priorité « Me prévenir »

## Requirements & Constraints

- Aucune double vente : réservation et confirmation atomiques et idempotentes ; les trois cas (simultané, paiement après expiration, vente ailleurs) sont testés sur le vrai PostgreSQL avant l'ouverture du Lot 2.
- Un passage en caisse porte les coordonnées de l'acheteur sans compte et produit une commande par artiste ; chaque commande a un numéro lisible issu d'un seul générateur.
- Montants toujours relus en base, jamais ceux du navigateur ; figés à la création du passage en caisse, insensibles à un changement ultérieur de tarif ou de slug.
- Deux échéances distinctes : la réservation (environ 30 min au paiement, environ 48 h en vente assistée, délai de priorité) et l'abandon de la commande, plus longue ; l'expiration de la réservation n'annule pas la commande. Durées et plafond de réservations simultanées par e-mail et par appareil sont des réglages.
- Paiement tardif : si les œuvres sont encore disponibles, la commande est confirmée ; sinon elle est annulée, un remboursement égal à l'allocation est demandé, un incident est enregistré, les autres commandes du même paiement restent confirmées. Une commande déjà annulée n'est jamais confirmée. Écart de montant ou de devise : rien n'est confirmé, incident.
- Remboursement : états `demandé` et `effectué`, exécuté à la main par l'équipe ; l'acheteur est prévenu sobrement.
- Vente assistée : réservée par l'équipe après un conseil ou une visite, rattachée à la demande d'origine (automatiquement si posée depuis la demande). Seul l'acteur `admin` agit, vérifié par test.
- E-mails : acheteur (lien, confirmation, annulation), artiste (« Nouvelle commande » avec échéance en heure fixe), équipe (alertes) ; un seul par événement même rejoué ; jamais d'adresse dans les journaux.

## Technical Decisions

- Nouveaux modules `commandes` et `paiement` (à ajouter à `MODULES_METIER` de `.eslintrc.js`) ; `disponibilite` reste seul propriétaire des états de disponibilité, `livraison` seul calculateur du prix et du délai (AD-12).
- Disponibilité effective (AD-7) : une seule définition (prédicat et fragment de requête) de « disponible pour cet acheteur » (publiée, non retirée, sans réservation active d'un autre, échéance comprise) ; réserver = mise à jour conditionnelle de toutes les œuvres du passage en une transaction, tout ou rien, erreur nommant l'œuvre (`oeuvre_indisponible`). Table `Reservation` (œuvre, passage en caisse, origine `paiement` | `vente_assistee` | `priorite`, échéance, issue) et index unique partiel « une réservation active par œuvre » via la préversion Prisma `partialIndexes`, avec test de CI de présence. Une réservation échue est libérée (issue `expiree`) dans la transaction de la nouvelle ; la protection ne dépend jamais du balayage. Une réservation du même passage ne le bloque pas.
- Paiement (AD-4) : un Paiement couvre 1 à N commandes d'un passage avec un montant alloué par commande (unique ou par commande = réglage, OQ-16 ouverte). États `ouvert` → `constate` ou `abandonne` par mise à jour conditionnelle (clé d'idempotence) ; paire (source, référence externe) unique. Ports Encaissement, Remboursement, Reversement ; adaptateur `constat-manuel` (qui, quand, référence). Point d'entrée unique `commandes.traiterPaiementConstate(fait)`, synchrone ; l'événement `PaiementConstate` relate sans déclencher. Aucun nom de prestataire hors `src/lib/paiement/adaptateurs/**`. Ne rien décider sur le montage ni le prestataire (OQ-1 ouverte).
- Confirmation (AD-8) : œuvres `vendue` par une mise à jour conditionnelle dont le nombre de lignes doit égaler celui des œuvres, puis commande `confirmee`.
- États de commande (AD-9) : table de transitions unique dans `commandes`, acteur vérifié (AD-15, `acteurCourant()`, rôle relu en base), transition horodatée avec son auteur, événement écrit (AD-11).
- Vendue ailleurs ou retrait (story 2.8 existante) : `disponibilite` annule la réservation, retient que la déclaration l'a interrompue et écrit `ReservationAnnulee` ; le gestionnaire de `commandes` annule la commande en attente seulement si elle est encore dans l'état attendu. L'annulation de la déclaration par l'artiste n'est permise que sans réservation interrompue (aujourd'hui `reservationInterrompue` est faux faute de réservations).
- Jeton `commande_assistee` (AD-14) : créé seulement par `acces/jetons.ts`, émis à l'envoi de l'e-mail, valeur en clair uniquement dans l'e-mail ; la page d'échange pose un cookie `httpOnly` puis redirige vers une URL sans jeton, en `Referrer-Policy: no-referrer`, hors mesure.
- Migration d'`Order` (AD-20, temps 1 à 3) : ajout des nouvelles tables, script idempotent de recopie (passage en caisse, commande, ligne, paiement), lecture basculée, ancienne table conservée en lecture pour le retour arrière ; `Order.artworkIds` contient des slugs, les lignes gardent l'id de l'œuvre plus un instantané du slug. Migration commitée, appliquée en production par le porteur seul.
- Interrupteur du Lot 2 (AD-17) : `lot2Ouvert()` ne gouverne que le passage en caisse public (déjà refusé dans `/api/checkout` ; le webhook Stripe existant reste une exception à AD-1 et doit rester idempotent) ; les ventes assistées (réservation, lien, constat manuel) n'en dépendent pas.
- Événements (AD-11) : tout effet naît d'un événement du catalogue typé, relié dans `abonnements.ts` (par `via(nom)` pour `notifications`), répartition attendue après la transaction ; les gestionnaires de `notifications` s'ajoutent à `via`. Balayage `api/balayage` protégé par secret : rejoue les événements en échec, libère les réservations échues, idempotent ; sans AQ-2 résolue, pas de rejeu automatique.
- Assiette de la commission (OQ-3 ouverte) : réglage, calcul de la somme due en un seul endroit (AD-24) ; hors périmètre de cet epic sauf à ne pas le contredire.
- « Me prévenir » : les inscriptions existent (`demandes`, rang calculé) ; à l'expiration, le premier inscrit est prévenu et reçoit une réservation `priorite`, puis le suivant ; le gestionnaire `retirerInscriptionsPrevenir` existant supprime les inscrits à la sortie de vente.

## UX & Interaction Patterns

- Récapitulatif acheteur : œuvres, commandes par artiste, montants recalculés côté serveur, réservation en heure fixe (jamais de compte à rebours), moyen de paiement transmis par l'équipe, Conseil WhatsApp. Pas de prix barré ni de promesse de délai de retour (OQ-2, OQ-4 ouvertes).
- Bandeau artiste après « Vendue ailleurs » sur œuvre réservée : « Un acheteur avait réservé cette œuvre. L'équipe Errancy le prévient et s'occupe d'un éventuel remboursement. Vous n'avez rien à faire. », sans lien « Annuler ».
- Vue admin des réservations en cours et journal des terminées avec issue, vue des incidents et des remboursements à traiter ; composants et textes dans `fr`, socles de l'Epic 3 (focus, 44 px, propriétés logiques).

## Cross-Story Dependencies

- 6.1 précède tout : 6.2 réserve les œuvres d'un passage en caisse, 6.3 les pose pour la vente assistée, 6.4 confirme, 6.5 traite le tardif, 6.6 annule sur `ReservationAnnulee`, 6.7 libère par balayage.
- Dépend de l'Epic 2 (`disponibilite`, déclarations 2.8), 3.3 et 3.4 (prix livré, événements), 4.1 (e-mails), 4.5 (inscrits) et 4.6 (rattachement aux demandes).
- 6.7 exige AQ-2 réglée ; la priorité côté panier est honorée en story 7.3, l'ouverture du lien dans le panier en 7.2, le suivi par lien en 7.7.
- Remboursement et reversement effectifs, moyen de paiement et identité de l'exploitant restent bloqués par OQ-1 ; hors Lot 2, rien de public n'est ouvert.
