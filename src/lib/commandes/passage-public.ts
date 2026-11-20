import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import {
  emettreJetonCommandePublique,
  lirePassageDuNavigateur,
  revoquerJetonCommandePublique,
} from '@/lib/acces/commande-publique'
import { compterTentative } from '@/lib/demandes/limites'
import { libererReservation, passageReservantLOeuvre, reserverOeuvres, reservationsActivesDuPassage } from '@/lib/disponibilite'
import { echeanceApres, estEchue } from '@/lib/disponibilite/reservation-regles'
import { repartirApresValidation } from '@/lib/evenements'
import { prixLivreFige } from '@/lib/livraison'
import { DUREE_RESERVATION_PAIEMENT_MINUTES, LIMITES_PASSAGE_PUBLIC, lot2Ouvert } from '@/lib/reglages'
import { validerCoordonnees, lireEntreeCoordonnees, type ErreursCoordonnees, type ValeurCoordonnees } from './coordonnees-regles'
import { abandonApres, creerPassageEnCaisse, type CommandeCreee, type RefusPassage } from './passage'
import { transitionPermise } from './etats'
import { lireCommandesDuPassage, type Recapitulatif } from './recapitulatif'
import { lireLienVenteAssistee } from './vente-assistee'

// Passage en caisse de l'acheteur sans compte (story 7.3, FR-10, FR-12, UX-DR37). « Continuer » du panier
// mène aux coordonnées ; à l'envoi valide, le passage et la réservation `paiement` (30 minutes) se créent
// en une seule transaction, tout ou rien (décision 1A). Le navigateur est rattaché à son passage par un
// jeton `commande_publique` (`acces`, cookie httpOnly posé par l'action, décision 2A). Aucun contrôle
// d'acteur (acheteur sans compte : la preuve est le jeton) ; tout passage public est refusé tant que le
// Lot 2 est fermé (AD-17) ; la vente assistée n'en dépend pas. Jamais d'e-mail ni d'adresse dans les
// journaux.

export type SaisiePassagePublic = {
  /** E-mail, nom, adresse (obligatoire ici) et téléphone, tels que saisis ; revalidés. */
  coordonnees: unknown
  /** Code ISO du pays de livraison (cookie `pays`). */
  pays: string
  /** Slugs des œuvres du panier. */
  oeuvres: readonly string[]
  /** Valeur du cookie de passage, si le navigateur en a un. */
  jeton?: string
  /** Adresse IP de la requête (limite d'envoi, empreinte salée) ; null si inconnue. */
  ip?: string | null
}

export type RefusPassagePublic =
  | { ok: false; code: 'ferme' | 'liste_vide' | 'devise_differente' | 'plafond_atteint' | 'invalide' | 'trop_de_demandes' | 'reservation_en_cours' }
  | Extract<RefusPassage, { code: 'coordonnees_invalides' | 'oeuvre_indisponible' | 'non_livree' }>

export type ResultatPassagePublic =
  | {
      ok: true
      passageId: string
      commandes: CommandeCreee[]
      echeance: Date
      /** Valeur en clair du jeton à poser dans le cookie ; absente si le passage du navigateur est repris. */
      jeton?: string
      reprise: boolean
    }
  | RefusPassagePublic

/** Refus qui annule la transaction entière. */
class Refus extends Error {
  constructor(readonly refus: { ok: false; code: string; slug?: string }) {
    super('passage_public_refuse')
  }
}

function minEcheance(echeances: Date[]): Date {
  return new Date(Math.min(...echeances.map((e) => e.getTime())))
}

type Tx = Prisma.TransactionClient

/**
 * Annule le passage dans la transaction de l'appelant : commandes `en_attente_paiement` → `annulee` (table
 * `etats.ts`), réservations libérées (issue `liberee`, jamais une œuvre vendue ou retirée), jeton révoqué.
 * Aucun remboursement (rien n'a été reçu) et aucun événement de commande (pas d'e-mail : c'est l'acheteur
 * qui renonce). `etat_invalide` si une commande est déjà confirmée ou historique (rien n'est écrit).
 */
async function annulerPassageDansTx(
  tx: Tx,
  passageId: string,
  maintenant: Date,
): Promise<{ ok: true; evenements: string[]; effet: boolean } | { ok: false; code: 'etat_invalide' }> {
  await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${passageId} FOR UPDATE`
  const commandes = await tx.commande.findMany({ where: { passageId }, select: { etat: true } })
  // Confirmée, prise en charge (8.1) ou historique : rien n'est annulé.
  if (commandes.some((c) => c.etat !== 'en_attente_paiement' && c.etat !== 'annulee')) return { ok: false, code: 'etat_invalide' }
  if (!transitionPermise('en_attente_paiement', 'annulee')) throw new Error('transition_interdite')
  const maj = await tx.commande.updateMany({ where: { passageId, etat: 'en_attente_paiement' }, data: { etat: 'annulee' } })
  const liberation = await libererReservation(passageId, { issue: 'liberee', maintenant }, tx)
  await revoquerJetonCommandePublique(tx, passageId, maintenant)
  return { ok: true, evenements: liberation.evenements, effet: maj.count > 0 || liberation.liberees > 0 }
}

export type ResultatAnnulationPassage = { ok: true; dejaAnnule: boolean } | { ok: false; code: 'etat_invalide' }

/**
 * « Modifier ma commande » : l'acheteur renonce à son passage (jeton du cookie, aucun contrôle d'acteur
 * mais jeton valide exigé) : commandes en attente annulées, réservations libérées, jeton révoqué, en une
 * transaction. Rejouée (jeton déjà révoqué ou inconnu) : succès sans effet. Refusé `etat_invalide` si une
 * commande est déjà confirmée. Fonctionne Lot 2 fermé (on peut toujours renoncer).
 */
export async function annulerPassagePublic(jeton: string | undefined, maintenant: Date = new Date()): Promise<ResultatAnnulationPassage> {
  const lien = await lirePassageDuNavigateur(prisma, jeton, maintenant)
  if (!lien) return { ok: true, dejaAnnule: true }
  const sortie = await prisma.$transaction((tx) => annulerPassageDansTx(tx, lien.passageId, maintenant), { maxWait: 5000, timeout: 20000 })
  if (!sortie.ok) return sortie
  await repartirApresValidation(sortie.evenements)
  return { ok: true, dejaAnnule: !sortie.effet }
}

const memeEnsemble = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Crée le passage de l'acheteur et réserve ses œuvres pour 30 minutes. Une seule transaction :
 * `creerPassageEnCaisse` (6.1, montants relus en base), `reserverOeuvres` (6.2, origine `paiement`,
 * plafond par e-mail, pas de contrôle par appareil) et le jeton ; une œuvre devenue indisponible,
 * non livrée ou le plafond annule tout (rien écrit, œuvre nommée). Les événements de disponibilité sont
 * répartis, attendus, avant de répondre. Si le navigateur porte déjà un passage réservé pour les mêmes
 * œuvres et le même pays : reprise (`reprise`) et coordonnées mises à jour ; pour d'autres œuvres ou un
 * autre pays : l'ancien passage est annulé (comme « Modifier ma commande ») dans la MÊME transaction. Limite
 * d'envoi par IP (`trop_de_demandes`), saisie invalide ni enregistrée ni comptée.
 */
export async function poserPassagePublic(saisie: SaisiePassagePublic, maintenant: Date = new Date()): Promise<ResultatPassagePublic> {
  if (!lot2Ouvert()) return { ok: false, code: 'ferme' }
  const slugs = [...new Set((Array.isArray(saisie.oeuvres) ? saisie.oeuvres : []).filter((s): s is string => typeof s === 'string' && s !== ''))]
  if (slugs.length === 0) return { ok: false, code: 'liste_vide' }
  const coordonnees = validerCoordonnees(saisie.coordonnees, { adresseObligatoire: true })
  if (!coordonnees.ok) return { ok: false, code: 'coordonnees_invalides', erreurs: coordonnees.erreurs }
  const { fenetreMinutes, parIp } = LIMITES_PASSAGE_PUBLIC
  if (!(await compterTentative('passage-ip', saisie.ip ?? null, { fenetreMinutes, seuil: parIp }, maintenant))) {
    return { ok: false, code: 'trop_de_demandes' }
  }

  const pays = typeof saisie.pays === 'string' ? saisie.pays.trim().toUpperCase() : ''
  const echeance = echeanceApres(maintenant, DUREE_RESERVATION_PAIEMENT_MINUTES)
  let evenements: string[] = []
  try {
    const pose = await prisma.$transaction(
      async (tx): Promise<{ passageId: string; commandes: CommandeCreee[]; jeton?: string; echeance: Date; reprise: boolean }> => {
        const lien = await lirePassageDuNavigateur(tx, saisie.jeton, maintenant)
        if (lien) {
          await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${lien.passageId} FOR UPDATE`
          const ancien = await lireCommandesDuPassage(lien.passageId, tx)
          const enAttente = ancien?.commandes.filter((c) => c.etat === 'en_attente_paiement') ?? []
          if (ancien && enAttente.length > 0) {
            const actives = (await reservationsActivesDuPassage(lien.passageId, tx)).filter((r) => !estEchue(r.echeance, maintenant))
            const anciensSlugs = enAttente.flatMap((c) => c.lignes.map((l) => l.slug))
            if (actives.length > 0 && ancien.pays === pays && memeEnsemble(slugs, anciensSlugs)) {
              await mettreAJourCoordonnees(tx, lien.passageId, coordonnees.valeur)
              return { passageId: lien.passageId, commandes: [], echeance: minEcheance(actives.map((r) => r.echeance)), reprise: true }
            }
            // Autres œuvres, autre pays ou réservation échue : l'ancien passage est annulé avant le nouveau.
            const sortie = await annulerPassageDansTx(tx, lien.passageId, maintenant)
            if (sortie.ok) evenements.push(...sortie.evenements)
          }
        }
        const passage = await creerPassageEnCaisse(
          { pays: saisie.pays, oeuvres: slugs, coordonnees: coordonnees.valeur },
          { echeanceReservation: echeance },
          tx,
        )
        if (!passage.ok) throw new Refus(passage)
        const reserve = await reserverOeuvres(
          { passageId: passage.passageId, slugs, origine: 'paiement', echeance, email: coordonnees.valeur.email, maintenant },
          tx,
        )
        if (!reserve.ok) throw new Refus(reserve)
        const jeton = await emettreJetonCommandePublique(tx, passage.passageId, echeance, maintenant)
        evenements.push(...reserve.evenements)
        return { passageId: passage.passageId, commandes: passage.commandes, jeton, echeance, reprise: false }
      },
      { maxWait: 5000, timeout: 20000 },
    )
    await repartirApresValidation(evenements)
    return { ok: true, ...pose }
  } catch (erreur) {
    if (!(erreur instanceof Refus)) throw erreur
    const refus = erreur.refus as RefusPassagePublic & { slug?: string }
    if (refus.code === 'oeuvre_indisponible' && (await reservationDeCetAcheteur(refus.slug, coordonnees.valeur.email, maintenant))) {
      // Réponse perdue ou cookie refusé : sa propre réservation tient l'œuvre. Pas de reprise sans jeton
      // (un tiers qui connaît l'e-mail ne doit pas la récupérer).
      return { ok: false, code: 'reservation_en_cours' }
    }
    return refus
  }
}

async function mettreAJourCoordonnees(tx: Tx, passageId: string, c: ValeurCoordonnees): Promise<void> {
  await tx.coordonneesAcheteur.update({
    where: { passageId },
    data: { email: c.email, nom: c.nom, adresse: c.adresse, telephone: c.telephone },
  })
}

/** Vrai si l'œuvre est tenue par une réservation active dont le passage porte cet e-mail. */
async function reservationDeCetAcheteur(slug: string | undefined, email: string, maintenant: Date): Promise<boolean> {
  if (!slug) return false
  const passageId = await passageReservantLOeuvre(slug, maintenant)
  if (!passageId) return false
  const c = await prisma.coordonneesAcheteur.findUnique({ where: { passageId }, select: { email: true } })
  return c?.email === email
}

export type PassagePublic = Recapitulatif & {
  passageId: string
  /** Aucune réservation active et non échue : « Votre réservation a pris fin ». */
  echue: boolean
}

/**
 * Passage du navigateur (cookie), relu en base à chaque appel : commandes et lignes figées, échéance de la
 * réservation (ou, si elle est terminée, celle du jeton), `echue`. null si le jeton est inconnu, révoqué
 * ou trop ancien, ou si le passage n'a plus de commande en attente (payée, annulée ou abandonnée).
 */
export async function lirePassagePublic(jeton: string | undefined, maintenant: Date = new Date()): Promise<PassagePublic | null> {
  const lien = await lirePassageDuNavigateur(prisma, jeton, maintenant)
  if (!lien) return null
  const passage = await lireCommandesDuPassage(lien.passageId)
  if (!passage) return null
  const enAttente = passage.commandes.filter((c) => c.etat === 'en_attente_paiement' && (!c.abandonneLe || c.abandonneLe > maintenant))
  if (enAttente.length === 0) return null
  const actives = (await reservationsActivesDuPassage(lien.passageId)).filter((r) => !estEchue(r.echeance, maintenant))
  const echeance = actives.length > 0 ? minEcheance(actives.map((r) => r.echeance)) : lien.echeance
  return {
    passageId: lien.passageId,
    pays: passage.pays,
    devise: passage.devise,
    echeance,
    echue: actives.length === 0,
    adresseRenseignee: passage.adresseRenseignee,
    commandes: enAttente.map(({ etat: _etat, abandonneLe: _abandon, ...c }) => c),
  }
}

export type ResultatReprise =
  | { ok: true; echeance: Date; jeton?: string; reprise: boolean }
  | { ok: false; code: 'ferme' | 'introuvable' | 'plafond_atteint' | 'invalide' }
  | { ok: false; code: 'oeuvre_indisponible' | 'prix_change'; slug: string }

/**
 * « Continuer » après l'échéance : retente la réservation du même passage (mêmes œuvres, mêmes lignes
 * figées), pour 30 minutes de plus, sous le verrou de la ligne du passage. Une œuvre prise entre-temps :
 * rien n'est réservé, l'œuvre est nommée. Une réservation encore active est reprise telle quelle (double
 * appui). Un nouveau jeton remplace l'ancien (même passage, nouvelle échéance).
 */
export async function reprendrePassagePublic(jeton: string | undefined, maintenant: Date = new Date()): Promise<ResultatReprise> {
  if (!lot2Ouvert()) return { ok: false, code: 'ferme' }
  const echeance = echeanceApres(maintenant, DUREE_RESERVATION_PAIEMENT_MINUTES)
  let evenements: string[] = []
  try {
    const resultat = await prisma.$transaction(
      async (tx): Promise<{ echeance: Date; jeton?: string; reprise: boolean }> => {
        const lien = await lirePassageDuNavigateur(tx, jeton, maintenant)
        if (!lien) throw new Refus({ ok: false, code: 'invalide' })
        await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${lien.passageId} FOR UPDATE`
        const actives = (await reservationsActivesDuPassage(lien.passageId, tx)).filter((r) => !estEchue(r.echeance, maintenant))
        if (actives.length > 0) return { echeance: minEcheance(actives.map((r) => r.echeance)), reprise: true }

        const commandes = await tx.commande.findMany({
          where: { passageId: lien.passageId, etat: 'en_attente_paiement', OR: [{ abandonneLe: null }, { abandonneLe: { gt: maintenant } }] },
          select: { lignes: { select: { slug: true, artworkId: true, prixCentimes: true, fraisCentimes: true, totalCentimes: true, devise: true } } },
        })
        const lignes = commandes.flatMap((c) => c.lignes)
        if (lignes.length === 0) throw new Refus({ ok: false, code: 'invalide' })
        const sansOeuvre = lignes.find((l) => l.artworkId === null)
        if (sansOeuvre) throw new Refus({ ok: false, code: 'oeuvre_indisponible', slug: sansOeuvre.slug })
        const courantes = await tx.artwork.findMany({
          where: { id: { in: lignes.map((l) => l.artworkId as string) } },
          select: { id: true, slug: true, prixCentimes: true, devise: true },
        })
        const slugs = lignes.map((l) => courantes.find((o) => o.id === l.artworkId)?.slug ?? l.slug)
        const coordonnees = await tx.coordonneesAcheteur.findUnique({ where: { passageId: lien.passageId }, select: { email: true } })
        if (!coordonnees) throw new Refus({ ok: false, code: 'invalide' })

        const reserve = await reserverOeuvres(
          { passageId: lien.passageId, slugs, origine: 'paiement', echeance, email: coordonnees.email, maintenant },
          tx,
        )
        if (!reserve.ok) {
          throw new Refus(reserve.code === 'oeuvre_indisponible' ? { ok: false, code: 'oeuvre_indisponible', slug: reserve.slug } : { ok: false, code: reserve.code })
        }
        // Prix, frais, devise et livraison relus par `livraison` et comparés aux lignes figées : un écart
        // annule tout (rien n'est réservé), l'acheteur recommence sa commande.
        const passageLu = await tx.passageEnCaisse.findUnique({ where: { id: lien.passageId }, select: { paysLivraison: true } })
        for (const l of lignes) {
          const o = courantes.find((x) => x.id === l.artworkId)
          if (!o || !passageLu) throw new Refus({ ok: false, code: 'oeuvre_indisponible', slug: l.slug })
          const prix = await prixLivreFige(tx, o, passageLu.paysLivraison)
          const identique =
            prix.livree &&
            prix.prixCentimes === l.prixCentimes &&
            prix.fraisCentimes === l.fraisCentimes &&
            prix.totalCentimes === l.totalCentimes &&
            prix.devise.toUpperCase() === l.devise.toUpperCase()
          if (!identique) throw new Refus({ ok: false, code: 'prix_change', slug: l.slug })
        }
        await tx.commande.updateMany({
          where: { passageId: lien.passageId, etat: 'en_attente_paiement' },
          data: { abandonneLe: abandonApres(echeance, maintenant) },
        })
        const nouveau = await emettreJetonCommandePublique(tx, lien.passageId, echeance, maintenant)
        evenements = reserve.evenements
        return { echeance, jeton: nouveau, reprise: false }
      },
      { maxWait: 5000, timeout: 20000 },
    )
    await repartirApresValidation(evenements)
    return { ok: true, ...resultat }
  } catch (erreur) {
    if (!(erreur instanceof Refus)) throw erreur
    const refus = erreur.refus
    if (refus.code === 'oeuvre_indisponible' || refus.code === 'prix_change') return { ok: false, code: refus.code, slug: refus.slug as string }
    if (refus.code === 'plafond_atteint') return { ok: false, code: 'plafond_atteint' }
    return { ok: false, code: 'invalide' }
  }
}

/** Retire le jeton d'un passage (réservation libérée ou passage clos) : le cookie du navigateur ne rouvre plus rien. */
export async function oublierPassagePublic(passageId: string, maintenant: Date = new Date()): Promise<void> {
  await prisma.$transaction((tx) => revoquerJetonCommandePublique(tx, passageId, maintenant))
}

export type ResultatComplement =
  | { ok: true }
  | { ok: false; code: 'coordonnees_invalides'; erreurs: ErreursCoordonnees }
  | { ok: false; code: 'introuvable' }

/**
 * Complète les coordonnées d'un passage : adresse de livraison (obligatoire) et téléphone seulement,
 * l'e-mail et le nom restent ceux de la pose (story 7.3, décision 3A : passage posé par l'équipe). Aucun
 * contrôle d'acteur ici : l'appelant a prouvé le passage (`completerCoordonneesDuLien`).
 */
export async function completerCoordonneesDuPassage(
  passageId: string,
  brut: unknown,
  tx: Prisma.TransactionClient = prisma,
): Promise<ResultatComplement> {
  const actuelles = await tx.coordonneesAcheteur.findUnique({ where: { passageId }, select: { email: true, nom: true } })
  if (!actuelles) return { ok: false, code: 'introuvable' }
  const saisie = lireEntreeCoordonnees(brut)
  const validation = validerCoordonnees({ ...saisie, email: actuelles.email, nom: actuelles.nom }, { adresseObligatoire: true })
  if (!validation.ok) {
    // L'e-mail et le nom viennent de la base : seules l'adresse et le téléphone sont corrigeables ici.
    const { adresse, telephone } = validation.erreurs
    return { ok: false, code: 'coordonnees_invalides', erreurs: { ...(adresse ? { adresse } : {}), ...(telephone ? { telephone } : {}) } }
  }
  await tx.coordonneesAcheteur.update({
    where: { passageId },
    // Un téléphone déjà saisi n'est jamais écrasé par un champ laissé vide.
    data: { adresse: validation.valeur.adresse, ...(validation.valeur.telephone ? { telephone: validation.valeur.telephone } : {}) },
  })
  return { ok: true }
}

/**
 * Complète les coordonnées du passage d'une vente assistée à partir du jeton du lien (cookie `commande`) :
 * seul un lien encore actif (réservation de vente assistée non échue) ouvre le passage. Sans effet du
 * Lot 2 (la vente assistée n'en dépend pas).
 */
export async function completerCoordonneesDuLien(jeton: string | undefined, brut: unknown, maintenant: Date = new Date()): Promise<ResultatComplement> {
  const lien = typeof jeton === 'string' ? await lireLienVenteAssistee(jeton, maintenant) : null
  if (!lien) return { ok: false, code: 'introuvable' }
  return completerCoordonneesDuPassage(lien.passageId, brut)
}
