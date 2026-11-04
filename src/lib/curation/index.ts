import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { refusPublication } from './file'
import { champAvailable, estEnCuration, estRecopiee, lireEtatVerrouille, type Publication } from '@/lib/disponibilite'

// Module curation (AD-6, story 2.2) : seul module qui écrit l'axe publication (`publication`).
// Un admin publie ou dépublie depuis l'administration (bascule historique, definirPublication) ;
// les œuvres déposées passent par la file de curation (story 2.7).
// Story 2.5 : propriétaire du descriptif, des dimensions et des photos ; dépôt par l'artiste
// (./depot, ./photos), règles pures partagées avec le formulaire (./depot-regles).
// Story 2.6 : expédition par zone (offres écrites via livraison), engagements, envoi en curation.
// Story 2.7 : curation par l'équipe (./file) — file, valider (exige l'accord signé), renvoyer avec
// commentaire, décisions conservées, accord signé de l'artiste ; règles pures dans ./curation-regles.
// La bascule definirPublication refuse désormais une œuvre en curation : la file est le seul chemin.
// Story 2.8 : « Remettre en vente » une œuvre retirée par l'artiste la renvoie en curation (./remise-en-vente).

export {
  enregistrerChamp,
  enregistrerOffreDepot,
  envoyerEnCuration,
  lireDepot,
  lireOeuvreEnCuration,
  publicationInitiale,
  repriseZonesPossible,
  reprendreZones,
  type DepotLu,
  type PhotoDepot,
  type RecapitulatifCuration,
  type RefusDepot,
  type ResultatDepot,
  type ResultatEnvoiCuration,
  type ResultatRecapitulatif,
} from './depot'
export { enregistrerPhoto, preparerEnvoiPhoto, type EnvoiSigne, type ResultatEnvoi, type ResultatPhoto } from './photos'
export * from './depot-regles'
export {
  basculesPublication,
  enregistrerAccord,
  fileDeCuration,
  oeuvreACurer,
  renvoyerOeuvre,
  validerOeuvre,
  type OeuvreACurer,
  type OeuvreEnFile,
  type RefusCuration,
  type ResultatAccord,
  type ResultatDecision,
  type ResultatFile,
  type ResultatOeuvreACurer,
} from './file'
export * from './curation-regles'
export { remettreEnVente, type ResultatRemiseEnVente } from './remise-en-vente'

export type ResultatPublication =
  | { ok: true }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'non_recopiee' | 'transition_interdite' | 'accord_absent' }

/**
 * Publie (`publiee`) ou dépublie (`brouillon`) une œuvre ; réservé aux admins, refusé pour une
 * œuvre pas encore recopiée, et pour une œuvre en curation (`transition_interdite`, story 2.7 :
 * elle se valide ou se renvoie depuis la file de curation). Pour publier (story 2.7) : refus d'une
 * œuvre passée par le dépôt sans validation en dernier lieu (`transition_interdite`, la file est le
 * seul chemin) et d'une œuvre dont l'artiste n'a pas d'accord signé (`accord_absent`). Tient aussi l'ancienne colonne `available` (double écriture, définie
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
    if (estEnCuration(actuel)) return { ok: false, code: 'transition_interdite' }
    if (publiee) {
      const refus = await refusPublication(tx, slug)
      if (refus) return { ok: false, code: refus }
    }
    await tx.artwork.update({
      where: { slug },
      data: { publication, ...champAvailable({ publication, disponibilite: actuel.disponibilite }) },
    })
    return { ok: true }
  })
}
