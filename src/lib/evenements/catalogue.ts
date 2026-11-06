// Catalogue typé unique des événements (story 3.4, AD-11, AR-9). Un événement est un fait passé
// (`NomAuPasseCompose`), versionné ; sa charge utile ne contient que des ids, jamais de donnée
// personnelle (ni e-mail, ni nom, ni IP). Tout nouvel événement se déclare ici (et nulle part ailleurs), puis ses gestionnaires dans
// `src/lib/abonnements.ts` (le typage l'impose) et un test.

/** Œuvre concernée et son artiste (ids seulement). */
export type ChargeOeuvre = { artworkId: string; artistId: string }

/** Nom → version courante. La clé fait foi à l'exécution comme au typage. */
export const VERSIONS_EVENEMENTS = {
  PublicationChangee: 1,
  DisponibiliteChangee: 1,
} as const

export type NomEvenement = keyof typeof VERSIONS_EVENEMENTS

/** Nom → charge utile. */
export type ChargesEvenements = {
  PublicationChangee: ChargeOeuvre
  DisponibiliteChangee: ChargeOeuvre
}

export type EvenementA<N extends NomEvenement> = { nom: N; charge: ChargesEvenements[N] }

/** Événement à écrire : union discriminée sur le nom. */
export type NouvelEvenement = { [N in NomEvenement]: EvenementA<N> }[NomEvenement]

/** Événement relu du journal. */
export type EvenementLu = NouvelEvenement & { id: string; version: number }

export function estNomEvenement(nom: unknown): nom is NomEvenement {
  return typeof nom === 'string' && Object.prototype.hasOwnProperty.call(VERSIONS_EVENEMENTS, nom)
}

function estChargeOeuvre(charge: unknown): charge is ChargeOeuvre {
  if (typeof charge !== 'object' || charge === null) return false
  const c = charge as Record<string, unknown>
  const cles = Object.keys(c)
  return (
    cles.length === 2 &&
    typeof c.artworkId === 'string' && c.artworkId !== '' &&
    typeof c.artistId === 'string' && c.artistId !== ''
  )
}

/** Contrôle à l'exécution : nom connu et charge conforme (deux ids, rien d'autre). */
export function evenementValide(evenement: { nom: unknown; charge: unknown }): evenement is NouvelEvenement {
  return estNomEvenement(evenement.nom) && estChargeOeuvre(evenement.charge)
}
