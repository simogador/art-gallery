// Panier public (FR-10, story 7.2) : règles pures, sans accès à la base, importables côté client
// (store du navigateur). Le navigateur ne garde que des slugs ; le serveur les valide à chaque recalcul.

/** Nombre maximal d'œuvres d'un panier (le serveur relit chacune en base). */
export const PLAFOND_PANIER = 20

/** Longueur maximale d'un slug accepté (un slug de titre reste bien en deçà). */
export const LONGUEUR_MAX_SLUG = 120

/**
 * Valeur inconnue (stockage du navigateur, corps d'une action) → slugs : chaînes non vides sans
 * espace, dédoublonnées, dans l'ordre d'arrivée, plafonnées. Toute autre valeur est ignorée, sans erreur.
 */
export function nettoyerSlugs(entree: unknown): string[] {
  if (!Array.isArray(entree)) return []
  const vus = new Set<string>()
  for (const valeur of entree) {
    if (typeof valeur !== 'string') continue
    const slug = valeur.trim()
    if (!slug || slug.length > LONGUEUR_MAX_SLUG || /\s/.test(slug)) continue
    vus.add(slug)
    if (vus.size >= PLAFOND_PANIER) break
  }
  return [...vus]
}
