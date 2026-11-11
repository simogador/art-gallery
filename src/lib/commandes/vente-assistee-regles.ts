// Règles pures de la vente assistée (story 6.3) : importables partout, sans accès à la base.

/** Dernier segment du chemin, sans query ni ancre : « /galerie/mon-oeuvre?x=1#a » → « mon-oeuvre ». */
function slugDe(brut: string): string {
  const chemin = brut.split(/[?#]/)[0]
  return chemin.split('/').filter(Boolean).pop() ?? ''
}

/**
 * Identifiants d'œuvre d'un texte : un par ligne, ou séparés par virgule, point-virgule, espace. Une
 * adresse de fiche collée (chemin ou URL complète) ne garde que son dernier segment ; sans doublon.
 */
export function lireIdentifiants(texte: string): string[] {
  return [...new Set(texte.split(/[\s,;]+/).map(slugDe).filter(Boolean))]
}
