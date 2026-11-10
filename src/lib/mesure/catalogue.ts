// Catalogue des événements de mesure (FR-27, AD-19, NFR-6, story 4.8). Liste typée unique : un
// événement porte son nom, le slug de l'œuvre (si elle existe) et la source d'arrivée, jamais de
// donnée personnelle (ni e-mail, ni téléphone, ni texte saisi, ni adresse de page).

export const NOMS_EVENEMENTS = [
  'VueFiche',
  'ChoixPays',
  'ClicConseil',
  'DemandeEnvoyee',
  // Typés dès maintenant, sans émetteur avant les Epics 6 et 7 (panier, commande).
  'AjoutPanier',
  'DebutCommande',
  'CommandeConfirmee',
] as const

export type NomEvenement = (typeof NOMS_EVENEMENTS)[number]

/** Événements que le navigateur peut signaler lui-même (le reste est émis par le serveur). */
export const EVENEMENTS_DU_NAVIGATEUR: readonly NomEvenement[] = ['ClicConseil']

export type EvenementMesure = {
  nom: NomEvenement
  /** Slug de l'œuvre concernée, absent quand l'événement n'en a pas. */
  slug?: string | null
}

/** Événement complet, tel que reçu par l'adaptateur. */
export type EvenementEnvoye = {
  nom: NomEvenement
  slug: string | null
  /** `utm_source` ou domaine du référent ; null quand elle est inconnue. */
  source: string | null
  /** Identifiant aléatoire du cookie de mesure, sans lien avec un compte. */
  visiteur: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function estNomEvenement(valeur: unknown): valeur is NomEvenement {
  return typeof valeur === 'string' && (NOMS_EVENEMENTS as readonly string[]).includes(valeur)
}

/** Slug valide (minuscules, chiffres, tirets, 120 caractères au plus) ; sinon null : jamais de texte libre. */
export function slugValide(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.length <= 120 && SLUG.test(valeur) ? valeur : null
}
