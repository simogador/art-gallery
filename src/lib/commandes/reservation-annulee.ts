import { prisma } from '@/lib/prisma'
import type { EvenementLuA } from '@/lib/evenements'
import { repartirApresValidation } from '@/lib/evenements'
import { annulerEnAttente } from './annulation'

// Vente ailleurs pendant une réservation (story 6.6, FR-21, FR-31, NFR-4) : gestionnaire de
// `ReservationAnnulee`. La commande en attente de paiement qui porte l'œuvre est annulée en entier
// (décision 2A : lignes figées, pas de lot incomplet), les réservations de ses autres œuvres sont
// libérées (jamais une œuvre vendue, vendue ailleurs ou retirée) et un incident `reservation_interrompue`
// est écrit pour l'équipe, qui prévient l'acheteur elle-même (aucun e-mail, décision 1A). Sans effet si
// la commande a déjà quitté l'état attendu. Un paiement constaté ensuite pour cette commande annulée
// donne un remboursement et un incident, jamais une vente (story 6.5). Ids seulement dans les journaux.

/** Annule la commande en attente du passage qui porte l'œuvre, sous le verrou du passage (comme un constat). */
export async function annulerSuiteReservationAnnulee(evenement: EvenementLuA<'ReservationAnnulee'>): Promise<void> {
  const { passageId, artworkId } = evenement.charge
  const evenements = await prisma.$transaction(
    async (tx): Promise<string[]> => {
      await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${passageId} FOR UPDATE`
      const commande = await tx.commande.findFirst({
        where: { passageId, etat: 'en_attente_paiement', lignes: { some: { artworkId } } },
        select: { id: true, lignes: { select: { artworkId: true } } },
      })
      if (!commande) return []
      const artworkIds = commande.lignes.flatMap((l) => (l.artworkId ? [l.artworkId] : []))
      const ev = await annulerEnAttente(tx, { id: commande.id, passageId, artworkIds }, null, new Date())
      if (ev === null) return []
      const deja = await tx.incident.findFirst({ where: { commandeId: commande.id, cause: 'reservation_interrompue' }, select: { id: true } })
      if (!deja) await tx.incident.create({ data: { passageId, commandeId: commande.id, cause: 'reservation_interrompue' } })
      return ev
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(evenements)
}
