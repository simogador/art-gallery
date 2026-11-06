import { revalidateTag } from 'next/cache'
import type { EvenementLu, NomEvenement } from '@/lib/evenements/catalogue'

// Racine de composition des événements (story 3.4) : qui réagit à quoi. Seul fichier qui relie un
// événement à ses gestionnaires ; il n'accède pas à la base (AD-1). Un gestionnaire ne reçoit jamais
// `tx`, ne lit que des ids, et ne fait rien si l'entité a déjà quitté l'état attendu (ici, une
// invalidation est idempotente et sans effet sur un état périmé).

export type Gestionnaire = (evenement: EvenementLu) => void | Promise<void>
export type Abonnement = { nom: string; gestionnaire: Gestionnaire }

/** Étiquettes du cache du catalogue (src/lib/catalogue/cache.ts, mêmes valeurs). */
export const etiquetteOeuvre = (artworkId: string) => `oeuvre:${artworkId}`
export const etiquetteArtiste = (artistId: string) => `artiste:${artistId}`
export const ETIQUETTE_CATALOGUE = 'catalogue'

/** Invalide les lectures du catalogue qui portent l'œuvre, son artiste ou la liste. */
export const invaliderCatalogue: Gestionnaire = (evenement) => {
  const { artworkId, artistId } = evenement.charge
  revalidateTag(etiquetteOeuvre(artworkId))
  revalidateTag(etiquetteArtiste(artistId))
  revalidateTag(ETIQUETTE_CATALOGUE)
}

export const ABONNEMENTS: { [N in NomEvenement]: Abonnement[] } = {
  PublicationChangee: [{ nom: 'invaliderCatalogue', gestionnaire: invaliderCatalogue }],
  DisponibiliteChangee: [{ nom: 'invaliderCatalogue', gestionnaire: invaliderCatalogue }],
}
