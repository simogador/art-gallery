import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { champAvailable, estRecopiee, lireEtatVerrouille, type Publication } from '@/lib/disponibilite'

// Module curation (AD-6, story 2.2) : seul module qui écrit l'axe publication (`publication`).
// En attendant la file de curation (story 2.7), un admin publie ou dépublie depuis
// l'administration. La règle d'accord signé (FR-16) viendra avec les stories 2.4 et 2.7.
// Story 2.5 : propriétaire du descriptif, des dimensions et des photos ; dépôt par l'artiste
// (./depot, ./photos), règles pures partagées avec le formulaire (./depot-regles).

export {
  enregistrerChamp,
  lireDepot,
  publicationInitiale,
  type DepotLu,
  type PhotoDepot,
  type RefusDepot,
  type ResultatDepot,
} from './depot'
export { enregistrerPhoto, preparerEnvoiPhoto, type EnvoiSigne, type ResultatEnvoi, type ResultatPhoto } from './photos'
export * from './depot-regles'

export type ResultatPublication =
  | { ok: true }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'non_recopiee' }

/**
 * Publie (`publiee`) ou dépublie (`brouillon`) une œuvre ; réservé aux admins, refusé pour une
 * œuvre pas encore recopiée. Tient aussi l'ancienne colonne `available` (double écriture, définie
 * par disponibilite), sur la ligne verrouillée : un paiement concurrent ne peut pas l'invalider.
 */
export async function definirPublication(
  acteur: Acteur,
  slug: string,
  publiee: boolean,
): Promise<ResultatPublication> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const publication: Publication = publiee ? 'publiee' : 'brouillon'
  return prisma.$transaction(async (tx): Promise<ResultatPublication> => {
    const actuel = await lireEtatVerrouille(tx, slug)
    if (!actuel) return { ok: false, code: 'introuvable' }
    if (!estRecopiee(actuel)) return { ok: false, code: 'non_recopiee' }
    await tx.artwork.update({
      where: { slug },
      data: { publication, ...champAvailable({ publication, disponibilite: actuel.disponibilite }) },
    })
    return { ok: true }
  })
}
