import { unstable_cache } from 'next/cache'
import { ETIQUETTE_CATALOGUE, etiquetteArtiste, etiquetteOeuvre } from '@/lib/abonnements'

// Cache des données du catalogue (story 3.4, AD-21) : lectures des œuvres, artistes et expositions,
// pas les pages ni le prix livré (calculé à chaque requête avec le cookie `pays`). Étiquetées par
// œuvre, par artiste et par liste ; invalidées par le gestionnaire `invaliderCatalogue`
// (src/lib/abonnements.ts) dès qu'un événement est réparti, et au plus tard après `revalidate`.
// La valeur passe par JSON : seules des données sérialisables (les dates reviennent en texte).

/** Une œuvre vendue ne reste jamais affichée plus longtemps (AD-21). */
export const REVALIDATE_SECONDES = 60

export { ETIQUETTE_CATALOGUE, etiquetteArtiste, etiquetteOeuvre }

/** `cle` doit contenir tout ce dont dépend la lecture (slug, bornes…) : la fermeture n'en fait pas partie. */
export function enCache<T>(cle: string[], etiquettes: string[], lire: () => Promise<T>): Promise<T> {
  return unstable_cache(lire, ['catalogue', ...cle], { tags: etiquettes, revalidate: REVALIDATE_SECONDES })()
}
