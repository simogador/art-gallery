import { estCodePays } from './pays'

// Prix livré (story 3.3, FR-3, FR-4, AD-12) : partie pure du module livraison, sans accès à la base,
// importable côté client (types, lecture du cookie `pays`). Seul endroit où le prix d'une œuvre et
// les frais d'une offre s'additionnent : `calculerPrixLivre` ici, et sa forme SQL (`TOTAL_LIVRE_SQL`,
// ./index.ts), qu'un test compare. Aucun composant ne calcule de prix.

/** Pourquoi une œuvre n'a pas de prix livré vers un pays. */
export type RaisonNonLivree = 'sans_prix' | 'pas_de_zone' | 'non_livree' | 'devise_differente'

export type PrixLivre =
  | {
      livree: true
      /** Prix de l'œuvre + frais de l'offre de la zone du pays, en centimes. */
      totalCentimes: number
      devise: string
      fraisCentimes: number
      /** Préparation + transport minimal, en jours. */
      delaiMinJours: number
      /** Préparation + transport maximal, en jours. */
      delaiMaxJours: number
    }
  | { livree: false; raison: RaisonNonLivree }

/** Ce que le calcul lit de l'œuvre. */
export type OeuvreAPrix = { prixCentimes: number | null; devise: string }

/** Offre de la zone du pays (null : pas d'offre pour cette zone). */
export type OffreAPrix = {
  livree: boolean
  fraisCentimes: number | null
  devise: string
  preparationJours: number | null
  transportMinJours: number | null
  transportMaxJours: number | null
}

/**
 * Règle du prix livré, dans cet ordre : œuvre sans prix → `sans_prix` ; pays sans zone →
 * `pas_de_zone` ; offre absente, `livree = false` ou incomplète → `non_livree` ; devise de l'offre
 * différente de celle de l'œuvre (casse ignorée) → `devise_differente` ; sinon total = prix + frais,
 * délai = préparation + transport min/max. Même règle que `TOTAL_LIVRE_SQL` (./index.ts).
 */
export function calculerPrixLivre(oeuvre: OeuvreAPrix, zoneTrouvee: boolean, offre: OffreAPrix | null): PrixLivre {
  if (oeuvre.prixCentimes === null) return { livree: false, raison: 'sans_prix' }
  if (!zoneTrouvee) return { livree: false, raison: 'pas_de_zone' }
  if (
    !offre ||
    !offre.livree ||
    offre.fraisCentimes === null ||
    offre.preparationJours === null ||
    offre.transportMinJours === null ||
    offre.transportMaxJours === null
  ) {
    return { livree: false, raison: 'non_livree' }
  }
  if (offre.devise.toUpperCase() !== oeuvre.devise.toUpperCase()) return { livree: false, raison: 'devise_differente' }
  return {
    livree: true,
    totalCentimes: oeuvre.prixCentimes + offre.fraisCentimes,
    devise: oeuvre.devise.toUpperCase(),
    fraisCentimes: offre.fraisCentimes,
    delaiMinJours: offre.preparationJours + offre.transportMinJours,
    delaiMaxJours: offre.preparationJours + offre.transportMaxJours,
  }
}

/* ── Sommes d'un panier (story 7.2, FR-10, FR-11) ───────────────────────── */

/**
 * Somme de prix livrés (carte d'un artiste, ou panier entier), seul endroit où les prix et les frais de
 * plusieurs œuvres s'additionnent hors de `calculerPrixLivre` : aucun composant ni autre module ne le fait.
 * Les œuvres non livrées ne sont pas comptées (`nonLivrees`) ; devises mêlées : `devise` nulle, montants
 * masqués ; aucune œuvre livrée : `livrees` à 0. Délai d'un colis : du plus long minimum au plus long maximum.
 */
export type SommePrixLivres = {
  livrees: number
  nonLivrees: number
  /** Devise commune des œuvres livrées ; null si aucune, ou si elles diffèrent (montants à masquer). */
  devise: string | null
  /** Prix des œuvres, sans les frais. */
  prixCentimes: number
  fraisCentimes: number
  /** Prix + frais des œuvres livrées. */
  totalCentimes: number
  delaiMinJours: number
  delaiMaxJours: number
}

/** Prix de l'œuvre seule (sans les frais) d'un prix livré, ou null si elle n'est pas livrée. */
export function prixSansFrais(p: PrixLivre | undefined): number | null {
  return p?.livree ? p.totalCentimes - p.fraisCentimes : null
}

export function sommerPrixLivres(prix: (PrixLivre | undefined)[]): SommePrixLivres {
  const livrees = prix.filter((p): p is Extract<PrixLivre, { livree: true }> => p?.livree === true)
  const devises = new Set(livrees.map((p) => p.devise))
  const somme = (valeurs: number[]) => valeurs.reduce((a, b) => a + b, 0)
  return {
    livrees: livrees.length,
    nonLivrees: prix.length - livrees.length,
    devise: devises.size === 1 ? [...devises][0] : null,
    prixCentimes: somme(livrees.map((p) => p.totalCentimes - p.fraisCentimes)),
    fraisCentimes: somme(livrees.map((p) => p.fraisCentimes)),
    totalCentimes: somme(livrees.map((p) => p.totalCentimes)),
    delaiMinJours: Math.max(0, ...livrees.map((p) => p.delaiMinJours)),
    delaiMaxJours: Math.max(0, ...livrees.map((p) => p.delaiMaxJours)),
  }
}

/* ── Pays du visiteur (cookie `pays`) ───────────────────────────────────── */

// Code ISO du pays de livraison choisi, mémorisé un an comme l'unité (story 3.2). Défaut France,
// hypothèse en attendant OQ-13 (pays deviné) : jamais déduit de l'adresse IP ni de la langue.

export const COOKIE_PAYS = 'pays'
export const PAYS_PAR_DEFAUT = 'FR'
/** Un an, en secondes. */
export const DUREE_COOKIE_PAYS_S = 365 * 24 * 60 * 60

/** Valeur du cookie → code pays ; absent ou invalide : FR. */
export function lirePays(valeur: string | null | undefined): string {
  const code = (valeur ?? '').trim().toUpperCase()
  return estCodePays(code) ? code : PAYS_PAR_DEFAUT
}

/** Cookie à poser (cookies().set) pour mémoriser le pays un an sur tout le site. */
export function cookiePays(code: string): {
  name: string
  value: string
  path: string
  maxAge: number
  sameSite: 'lax'
  httpOnly: true
  secure: boolean
} {
  // Lu seulement par le serveur : jamais exposé au JavaScript de la page.
  return {
    name: COOKIE_PAYS,
    value: lirePays(code),
    path: '/',
    maxAge: DUREE_COOKIE_PAYS_S,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}

/* ── Tri sur le prix livré (galerie) ────────────────────────────────────── */

/** Total livré en centimes, ou null si l'œuvre n'est pas livrée (ou sans prix livré calculé). */
export function totalLivre(o: { prixLivre?: PrixLivre }): number | null {
  return o.prixLivre?.livree ? o.prixLivre.totalCentimes : null
}

/** Comparaison sur le prix livré (sens 1 : croissant, -1 : décroissant) ; non livrées en dernier dans les deux sens. */
export function comparerPrixLivre(a: { prixLivre?: PrixLivre }, b: { prixLivre?: PrixLivre }, sens: 1 | -1): number {
  const x = totalLivre(a)
  const y = totalLivre(b)
  if (x === null) return y === null ? 0 : 1
  if (y === null) return -1
  return sens * (x - y)
}
