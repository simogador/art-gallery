import { getArtworkBySlug, getArtistArtworksBySlug, artisteDOeuvreRetiree } from '@/lib/catalogue'
import { nomPays, prixSansFrais, sommerPrixLivres, type PrixLivre, type SommePrixLivres } from '@/lib/livraison'
import type { Artwork } from '@/lib/types'
import { nettoyerSlugs } from './regles'

// Module panier (FR-10, FR-11, AD-13, story 7.2) : recompose le panier du visiteur côté serveur.
// Le navigateur ne fournit que des slugs ; chaque œuvre est relue par `catalogue` (visibilité,
// disponibilité) avec son prix livré vers le pays (`livraison`), jamais d'un prix du client. Une carte
// par artiste (un colis par artiste) ; les sommes viennent de `livraison` (`sommerPrixLivres`), jamais
// d'une addition ici. Lecture seule : aucun passage en caisse ni réservation (stories 7.3 et suivantes).
// Aucun accès direct à la base : tout passe par les API publiques de `catalogue` et `livraison`.

export { PLAFOND_PANIER, nettoyerSlugs } from './regles'

/** Nombre d'œuvres proches proposées sous une œuvre devenue indisponible. */
export const NOMBRE_OEUVRES_PROCHES = 3

export type LignePanier = {
  slug: string
  titre: string
  imageUrl: string | null
  gradient: string
  accentColor: string
  /** Prix livré vers le pays (livraison) ; non livrée : la ligne le dit et n'est pas comptée. */
  prixLivre: PrixLivre
  /** Prix de l'œuvre sans les frais (livraison), null si elle n'est pas livrée. */
  prixOeuvreCentimes: number | null
}

export type CommandePanier = {
  /** Numéro d'ordre de la carte (1, 2…), dans l'ordre d'arrivée des œuvres. */
  numero: number
  artiste: { slug: string; nom: string }
  lignes: LignePanier[]
  somme: SommePrixLivres
}

export type LigneIndisponible = {
  slug: string
  /** Titre connu (œuvre vendue ou réservée) ; null si l'œuvre n'est plus présentée du tout. */
  titre: string | null
  artisteSlug: string | null
  artisteNom: string | null
  /** Jusqu'à trois œuvres disponibles du même artiste (hors panier), avec leur prix livré. */
  proches: Artwork[]
}

export type PanierCompose = {
  pays: { code: string; nom: string }
  commandes: CommandePanier[]
  indisponibles: LigneIndisponible[]
  /** Somme de toutes les œuvres livrées du panier (total général). */
  total: SommePrixLivres
}

/** Œuvre achetable : visible, disponible et avec un prix. */
function achetable(o: Artwork | null): o is Artwork {
  return o !== null && !o.sold && o.prixLivre !== undefined && !(o.prixLivre.livree === false && o.prixLivre.raison === 'sans_prix')
}

export async function composerPanier(entree: unknown, codePays: string): Promise<PanierCompose> {
  const slugs = nettoyerSlugs(entree)
  const oeuvres = await Promise.all(slugs.map((slug) => getArtworkBySlug(slug, codePays)))

  const commandes: CommandePanier[] = []
  const tous: PrixLivre[] = []
  const indisponibles: { slug: string; oeuvre: Artwork | null }[] = []

  slugs.forEach((slug, i) => {
    const oeuvre = oeuvres[i]
    if (!achetable(oeuvre)) {
      indisponibles.push({ slug, oeuvre })
      return
    }
    const prixLivre = oeuvre.prixLivre as PrixLivre
    let carte = commandes.find((c) => c.artiste.slug === oeuvre.artistId)
    if (!carte) {
      carte = {
        numero: commandes.length + 1,
        artiste: { slug: oeuvre.artistId, nom: oeuvre.artist },
        lignes: [],
        somme: sommerPrixLivres([]),
      }
      commandes.push(carte)
    }
    carte.lignes.push({
      slug,
      titre: oeuvre.title,
      imageUrl: oeuvre.imageUrl,
      gradient: oeuvre.gradient,
      accentColor: oeuvre.accentColor,
      prixLivre,
      prixOeuvreCentimes: prixSansFrais(prixLivre),
    })
    tous.push(prixLivre)
  })
  for (const carte of commandes) carte.somme = sommerPrixLivres(carte.lignes.map((l) => l.prixLivre))

  const dansLePanier = new Set(slugs)
  // Artiste de chaque œuvre indisponible : œuvre inconnue du catalogue public, seule une œuvre retirée
  // donne encore le sien.
  const artistes = await Promise.all(
    indisponibles.map(({ slug, oeuvre }) => (oeuvre ? Promise.resolve(oeuvre.artistId) : artisteDOeuvreRetiree(slug))),
  )
  // Une seule lecture par artiste ; les œuvres proches ne sont données qu'à la première ligne
  // indisponible de cet artiste.
  const proches = new Map<string, Artwork[]>()
  await Promise.all(
    [...new Set(artistes.filter((a): a is string => a !== null))].map(async (artisteSlug) => {
      const lues = await getArtistArtworksBySlug(artisteSlug, codePays)
      proches.set(artisteSlug, lues.filter((o) => !dansLePanier.has(o.id) && achetable(o)).slice(0, NOMBRE_OEUVRES_PROCHES))
    }),
  )
  const dejaMontres = new Set<string>()
  const lignesIndisponibles = indisponibles.map(({ slug, oeuvre }, i): LigneIndisponible => {
    const artisteSlug = artistes[i]
    const premiere = artisteSlug !== null && !dejaMontres.has(artisteSlug)
    if (artisteSlug !== null) dejaMontres.add(artisteSlug)
    return {
      slug,
      titre: oeuvre?.title ?? null,
      artisteSlug,
      artisteNom: oeuvre?.artist ?? null,
      proches: premiere ? (proches.get(artisteSlug) ?? []) : [],
    }
  })

  return {
    pays: { code: codePays, nom: nomPays(codePays) },
    commandes,
    indisponibles: lignesIndisponibles,
    total: sommerPrixLivres(tous),
  }
}
