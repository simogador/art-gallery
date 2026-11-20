import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { lirePassageDuSuivi } from '@/lib/acces/suivi'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { demanderRemboursement } from './annulation'
import { transitionPermise } from './etats'
import { signerEnvoiPhoto, verifierPhotos, type EnvoiPhotoSigne } from './photos-reclamation'
import { delaiRetourEchu, validerReclamation, type ErreursReclamation } from './reclamation-regles'
import { validerMotif, type ErreurMotif } from './suivi-equipe-regles'

// Réclamation et retour (story 8.5, FR-30, FR-15, AD-9, AD-10, AD-15, AD-16). Seul propriétaire de `Reclamation` et
// `PhotoReclamation`. L'acheteur signale un problème sur une commande `livree` de SON passage (jeton `suivi` du
// navigateur, jamais un identifiant du client), dans le délai de retour (`retourAvant`, « échu » calculé à la
// lecture) ; une seule réclamation par commande, un refus est définitif (décision 4A). L'équipe (admin relu en
// base) l'accepte ou la refuse (motif de 10 à 500 caractères), puis enregistre la réception du retour : `livree` →
// `retournee` par la table de transitions, avec le remboursement demandé (total par défaut, partiel possible,
// jamais au-delà de l'allocation, décision 3B). Tout se passe sous le verrou de la ligne du passage (comme le
// constat, la prise en charge, l'expédition et la livraison), par mises à jour conditionnelles, avec l'événement
// écrit dans la transaction et la répartition attendue après. Rejeu : succès sans effet, un seul événement. L'artiste
// ne lit jamais la réclamation, sa description ni ses photos. Journaux et charges d'événements : ids seulement ; ni
// description, ni motif de refus, ni adresse des photos.

const LONGUEUR_NUMERO_MAX = 64

function numeroLisible(numero: unknown): numero is string {
  return typeof numero === 'string' && numero.trim() !== '' && numero.length <= LONGUEUR_NUMERO_MAX
}

async function verrouillerPassage(tx: Prisma.TransactionClient, passageId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${passageId} FOR UPDATE`
}

// ── Acheteur ─────────────────────────────────────────────────────────────────

export type RefusAcheteur = 'introuvable' | 'etat_invalide' | 'delai_echu' | 'reclamation_deja_traitee'

export type ResultatSignalement =
  | { ok: true; dejaOuverte: boolean }
  | { ok: false; code: RefusAcheteur | 'envoi_indisponible' }
  | { ok: false; code: 'invalide'; erreurs: ErreursReclamation }

export type ResultatEnvoiPhoto = { ok: true; envoi: EnvoiPhotoSigne } | { ok: false; code: RefusAcheteur | 'envoi_indisponible' }

/**
 * Signature d'un envoi direct vers Cloudinary pour une photo de la réclamation. Mêmes conditions que le
 * signalement (jeton `suivi` valide, commande `livree` de ce passage, délai non échu, aucune réclamation) : rien
 * n'est signé pour une commande qui ne peut plus être signalée. Lecture seule.
 */
export async function preparerEnvoiPhotoReclamation(jetonSuivi: string | undefined, numero: string, maintenant: Date = new Date()): Promise<ResultatEnvoiPhoto> {
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  const lien = await lirePassageDuSuivi(prisma, jetonSuivi, maintenant)
  if (!lien) return { ok: false, code: 'introuvable' }
  const commande = await prisma.commande.findUnique({
    where: { numero: numero.trim() },
    select: { id: true, passageId: true, etat: true, retourAvant: true, reclamation: { select: { id: true } } },
  })
  if (!commande || commande.passageId !== lien.passageId) return { ok: false, code: 'introuvable' }
  if (commande.reclamation) return { ok: false, code: 'reclamation_deja_traitee' }
  if (commande.etat !== 'livree') return { ok: false, code: 'etat_invalide' }
  if (delaiRetourEchu(commande.retourAvant, maintenant)) return { ok: false, code: 'delai_echu' }
  const envoi = signerEnvoiPhoto(commande.id)
  return envoi ? { ok: true, envoi } : { ok: false, code: 'envoi_indisponible' }
}

/**
 * « Signaler un problème » : l'acheteur dépose sa réclamation (motif, description, 0 à 3 photos déjà envoyées à
 * Cloudinary, dont la réponse est revérifiée ici). Commande d'un autre passage ou jeton invalide : `introuvable` ;
 * autre état que `livree` : `etat_invalide` ; délai échu : `delai_echu` ; une réclamation existe : `dejaOuverte` si
 * elle est ouverte (succès sans effet), sinon `reclamation_deja_traitee`. Rien n'est écrit sur un refus.
 */
export async function signalerProbleme(
  jetonSuivi: string | undefined,
  numero: string,
  saisie: { motif?: unknown; description?: unknown; photos?: unknown },
  maintenant: Date = new Date(),
): Promise<ResultatSignalement> {
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  const lien = await lirePassageDuSuivi(prisma, jetonSuivi, maintenant)
  if (!lien) return { ok: false, code: 'introuvable' }
  const brutes = saisie?.photos === undefined || saisie?.photos === null ? [] : saisie.photos
  if (!Array.isArray(brutes)) return { ok: false, code: 'invalide', erreurs: { photos: 'invalide' } }
  const valide = validerReclamation(saisie, brutes.length)
  if (!valide.ok) return { ok: false, code: 'invalide', erreurs: valide.erreurs }

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatSignalement; evenements: string[] }> => {
      const fin = (resultat: ResultatSignalement, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, passageId: true } })
      if (!trouvee || !trouvee.passageId || trouvee.passageId !== lien.passageId) return fin({ ok: false, code: 'introuvable' })
      await verrouillerPassage(tx, trouvee.passageId)
      const commande = await tx.commande.findUnique({
        where: { id: trouvee.id },
        select: { etat: true, retourAvant: true, reclamation: { select: { etat: true } } },
      })
      if (!commande) return fin({ ok: false, code: 'introuvable' })
      if (commande.reclamation) return commande.reclamation.etat === 'ouverte' ? fin({ ok: true, dejaOuverte: true }) : fin({ ok: false, code: 'reclamation_deja_traitee' })
      if (commande.etat !== 'livree') return fin({ ok: false, code: 'etat_invalide' })
      if (delaiRetourEchu(commande.retourAvant, maintenant)) return fin({ ok: false, code: 'delai_echu' })
      const photos = verifierPhotos(trouvee.id, brutes)
      if (!photos.ok) {
        return photos.code === 'indisponible'
          ? fin({ ok: false, code: 'envoi_indisponible' })
          : fin({ ok: false, code: 'invalide', erreurs: { photos: photos.code } })
      }
      const cree = await tx.reclamation.create({
        data: {
          commandeId: trouvee.id,
          motif: valide.motif,
          description: valide.description,
          photos: { create: photos.photos.map((p) => ({ url: p.url, publicId: p.publicId })) },
        },
        select: { id: true },
      })
      const evenement = await ecrireEvenement(tx, { nom: 'ReclamationOuverte', charge: { reclamationId: cree.id } })
      return fin({ ok: true, dejaOuverte: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}

// ── Équipe ───────────────────────────────────────────────────────────────────

export type ResultatDecision =
  | { ok: true; dejaTraitee: boolean }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'etat_invalide' }

export type ResultatRefus = ResultatDecision | { ok: false; code: 'motif_invalide'; erreur: ErreurMotif }

type Decision = { etatCible: 'acceptee' | 'refusee'; motifRefus: string | null }

async function decider(acteur: Acteur & { type: 'admin' }, numero: string, decision: Decision, maintenant: Date): Promise<ResultatDecision> {
  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatDecision; evenements: string[] }> => {
      const fin = (resultat: ResultatDecision, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, passageId: true } })
      if (!trouvee || !trouvee.passageId) return fin({ ok: false, code: 'introuvable' })
      await verrouillerPassage(tx, trouvee.passageId)
      const commande = await tx.commande.findUnique({ where: { id: trouvee.id }, select: { etat: true, reclamation: { select: { id: true, etat: true } } } })
      if (!commande?.reclamation) return fin({ ok: false, code: 'introuvable' })
      // Rejeu : la même décision déjà prise est un succès sans effet (la première date, le premier auteur et le premier motif restent).
      if (commande.reclamation.etat === decision.etatCible) return fin({ ok: true, dejaTraitee: true })
      if (commande.reclamation.etat !== 'ouverte' || commande.etat !== 'livree') return fin({ ok: false, code: 'etat_invalide' })
      const maj = await tx.reclamation.updateMany({
        where: { id: commande.reclamation.id, etat: 'ouverte' },
        data: { etat: decision.etatCible, motifRefus: decision.motifRefus, decidePar: acteur.userId, decideLe: maintenant },
      })
      // Filet : jamais atteint sous le verrou du passage.
      if (maj.count !== 1) return fin({ ok: true, dejaTraitee: true })
      const evenement = await ecrireEvenement(tx, { nom: 'ReclamationTraitee', charge: { reclamationId: commande.reclamation.id } })
      return fin({ ok: true, dejaTraitee: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}

/** « Accepter le retour » : admin seulement (acteur relu en base). Aucun remboursement ici (décision 3B). */
export async function accepterReclamation(acteur: Acteur, numero: string, maintenant: Date = new Date()): Promise<ResultatDecision> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  return decider(acteur, numero, { etatCible: 'acceptee', motifRefus: null }, maintenant)
}

/** « Refuser » : admin seulement ; motif de 10 à 500 caractères, lu par l'acheteur. Un refus est définitif (décision 4A). */
export async function refuserReclamation(acteur: Acteur, numero: string, motif: string, maintenant: Date = new Date()): Promise<ResultatRefus> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const valide = validerMotif(motif)
  if (!valide.ok) return { ok: false, code: 'motif_invalide', erreur: valide.erreur }
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  return decider(acteur, numero, { etatCible: 'refusee', motifRefus: valide.motif }, maintenant)
}

export type ResultatRetour =
  | { ok: true; dejaRetournee: boolean }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'etat_invalide' }
  | { ok: false; code: 'montant_depasse' }

/**
 * « Retour reçu » : admin seulement. Réclamation `acceptee` sur une commande `livree` payée : `livree` → `retournee`
 * (mise à jour conditionnelle sous le verrou du passage), remboursement `demande` du montant (allocation de la
 * commande par défaut, partiel si `montantCentimes` est donné, jamais nul ni au-delà de l'allocation : `montant_depasse`,
 * rien d'écrit, la commande reste `livree`). Rejeu : `dejaRetournee`, un seul remboursement et un seul événement.
 */
export async function enregistrerRetourRecu(
  acteur: Acteur,
  numero: string,
  saisie: { montantCentimes?: number | null } = {},
  maintenant: Date = new Date(),
): Promise<ResultatRetour> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  const montant = saisie?.montantCentimes === undefined || saisie?.montantCentimes === null ? undefined : saisie.montantCentimes
  if (!transitionPermise('livree', 'retournee')) throw new Error('transition_interdite')

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatRetour; evenements: string[] }> => {
      const fin = (resultat: ResultatRetour, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, passageId: true } })
      if (!trouvee || !trouvee.passageId) return fin({ ok: false, code: 'introuvable' })
      await verrouillerPassage(tx, trouvee.passageId)
      const commande = await tx.commande.findUnique({ where: { id: trouvee.id }, select: { etat: true, devise: true, reclamation: { select: { etat: true } } } })
      if (!commande) return fin({ ok: false, code: 'introuvable' })
      if (commande.etat === 'retournee') return fin({ ok: true, dejaRetournee: true })
      if (commande.etat !== 'livree' || commande.reclamation?.etat !== 'acceptee') return fin({ ok: false, code: 'etat_invalide' })
      // Remboursement rattaché au paiement constaté du passage : sans paiement, rien à rembourser.
      const paiement = await tx.paiement.findFirst({ where: { passageId: trouvee.passageId, etat: 'constate' }, select: { id: true } })
      if (!paiement) return fin({ ok: false, code: 'etat_invalide' })
      // Avant toute écriture sur la commande : un montant refusé ne laisse rien derrière lui.
      const remboursement = await demanderRemboursement(tx, { id: trouvee.id }, paiement.id, commande.devise, montant)
      if (remboursement.refus) return fin({ ok: false, code: 'montant_depasse' })
      const maj = await tx.commande.updateMany({
        where: { id: trouvee.id, etat: 'livree' },
        data: { etat: 'retournee', retourRecuLe: maintenant, retourRecuPar: acteur.userId },
      })
      // Filet : jamais atteint sous le verrou du passage.
      if (maj.count !== 1) return fin({ ok: true, dejaRetournee: true })
      const evenement = await ecrireEvenement(tx, { nom: 'CommandeRetournee', charge: { commandeId: trouvee.id } })
      return fin({ ok: true, dejaRetournee: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}
