import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { VISIBLE } from '@/lib/disponibilite/etats'
import { prixLivreFige, type RaisonNonLivree } from '@/lib/livraison'
import { validerCoordonnees, type ErreursCoordonnees } from './coordonnees-regles'
import { ETAT_INITIAL, type EtatCommande } from './etats'
import { genererNumero } from './numero'

// Passage en caisse (story 6.1, FR-10, AD-12, AR-10) : crée, en une transaction, un passage, les
// coordonnées de l'acheteur sans compte, une commande `en_attente_paiement` par artiste et leurs lignes
// aux montants figés. Montants relus en base et calculés par `livraison`, jamais ceux de l'appelant.
// Aucun contrôle d'acteur : l'appelant (6.3 pour l'équipe, 7.2 pour le public) le fait. La réservation
// des œuvres est la story 6.2 ; ni e-mail ni adresse dans les journaux.

export type EntreePassage = {
  /** Code ISO du pays de livraison. */
  pays: string
  /** Slugs des œuvres (identifiant de l'œuvre dans le panier et le checkout) ; un doublon compte une fois. */
  oeuvres: readonly string[]
  /** Coordonnées de l'acheteur, validées ici (`coordonnees-regles`). */
  coordonnees: unknown
}

export type RefusPassage =
  | { ok: false; code: 'liste_vide' | 'devise_differente' }
  | { ok: false; code: 'coordonnees_invalides'; erreurs: ErreursCoordonnees }
  | { ok: false; code: 'oeuvre_indisponible'; slug: string }
  | { ok: false; code: 'non_livree'; slug: string; raison: RaisonNonLivree }

export type CommandeCreee = { id: string; numero: string; artistId: string; devise: string; lignes: number }
export type ResultatPassage = { ok: true; passageId: string; commandes: CommandeCreee[] } | RefusPassage

type Options = {
  /** Générateur de numéros (tests : forcer une collision). */
  generateur?: () => string
}

const TOURS_NUMERO_MAX = 20
const ESSAIS_MAX = 3

function codeErreur(erreur: unknown): string | undefined {
  return (erreur as { code?: string } | null)?.code
}

/** `n` numéros distincts, absents de la base ; un numéro déjà pris est simplement retiré au sort. */
async function numerosLibres(tx: Prisma.TransactionClient, n: number, generer: () => string): Promise<string[]> {
  const retenus: string[] = []
  for (let tour = 0; tour < TOURS_NUMERO_MAX && retenus.length < n; tour++) {
    const candidats = new Set<string>()
    // Un tirage par numéro manquant (un générateur qui répète le même numéro n'en fournit qu'un).
    for (let i = n - retenus.length; i > 0; i--) candidats.add(generer())
    for (const c of retenus) candidats.delete(c)
    const pris = new Set(
      (await tx.commande.findMany({ where: { numero: { in: [...candidats] } }, select: { numero: true } })).map((c) => c.numero),
    )
    for (const c of candidats) if (!pris.has(c) && retenus.length < n) retenus.push(c)
  }
  if (retenus.length < n) throw new Error('numero_commande_indisponible')
  return retenus
}

/**
 * Crée le passage en caisse. Tout est refusé (rien d'écrit) ou tout est écrit : liste vide, coordonnées
 * invalides, œuvre non visible ou sans prix (`oeuvre_indisponible`), devises mélangées, œuvre non
 * livrée vers le pays (`non_livree`, avec la raison de `livraison`).
 */
export async function creerPassageEnCaisse(entree: EntreePassage, options: Options = {}): Promise<ResultatPassage> {
  const slugs = [...new Set(entree.oeuvres.filter((s): s is string => typeof s === 'string' && s !== ''))]
  if (slugs.length === 0) return { ok: false, code: 'liste_vide' }
  const coordonnees = validerCoordonnees(entree.coordonnees)
  if (!coordonnees.ok) return { ok: false, code: 'coordonnees_invalides', erreurs: coordonnees.erreurs }
  const pays = typeof entree.pays === 'string' ? entree.pays.trim().toUpperCase() : ''
  const generer = options.generateur ?? genererNumero

  for (let essai = 1; ; essai++) {
    try {
      return await prisma.$transaction((tx) => ecrirePassage(tx, slugs, pays, coordonnees.valeur, generer), {
        maxWait: 5000,
        timeout: 20000,
      })
    } catch (erreur) {
      // Numéro pris entre la vérification et l'écriture (deux passages simultanés) : on recommence.
      if (codeErreur(erreur) === 'P2002' && essai < ESSAIS_MAX) continue
      throw erreur
    }
  }
}

async function ecrirePassage(
  tx: Prisma.TransactionClient,
  slugs: string[],
  pays: string,
  coordonnees: { email: string; nom: string; adresse: string | null; telephone: string | null },
  generer: () => string,
): Promise<ResultatPassage> {
  // `AND` : `VISIBLE` porte une clé `artist` qu'un étalement à côté d'une autre écraserait.
  const lues = await tx.artwork.findMany({
    where: { AND: [VISIBLE, { slug: { in: slugs } }] },
    select: { id: true, slug: true, title: true, prixCentimes: true, devise: true, artistId: true },
  })
  const parSlug = new Map(lues.map((o) => [o.slug, o]))
  const oeuvres = []
  for (const slug of slugs) {
    const o = parSlug.get(slug)
    if (!o || o.prixCentimes === null) return { ok: false, code: 'oeuvre_indisponible', slug }
    oeuvres.push(o)
  }
  const devise = oeuvres[0].devise.toUpperCase()
  if (oeuvres.some((o) => o.devise.toUpperCase() !== devise)) return { ok: false, code: 'devise_differente' }

  const lignes = []
  for (const o of oeuvres) {
    const prix = await prixLivreFige(tx, o, pays)
    if (!prix.livree) return { ok: false, code: 'non_livree', slug: o.slug, raison: prix.raison }
    lignes.push({ oeuvre: o, prix })
  }

  // Une commande par artiste, dans l'ordre d'apparition.
  const parArtiste = new Map<string, typeof lignes>()
  for (const l of lignes) parArtiste.set(l.oeuvre.artistId, [...(parArtiste.get(l.oeuvre.artistId) ?? []), l])
  const numeros = await numerosLibres(tx, parArtiste.size, generer)

  const passage = await tx.passageEnCaisse.create({
    data: { paysLivraison: pays, devise, coordonnees: { create: coordonnees } },
    select: { id: true },
  })
  const commandes: CommandeCreee[] = []
  let rang = 0
  for (const [artistId, deLArtiste] of parArtiste) {
    const etat: EtatCommande = ETAT_INITIAL
    const commande = await tx.commande.create({
      data: {
        numero: numeros[rang++],
        passageId: passage.id,
        artistId,
        etat,
        devise,
        lignes: {
          create: deLArtiste.map(({ oeuvre, prix }) => ({
            artworkId: oeuvre.id,
            slug: oeuvre.slug,
            titre: oeuvre.title,
            prixCentimes: prix.prixCentimes,
            fraisCentimes: prix.fraisCentimes,
            totalCentimes: prix.totalCentimes,
            devise: prix.devise.toUpperCase(),
            zoneId: prix.zoneId,
            zoneNom: prix.zoneNom,
            delaiMinJours: prix.delaiMinJours,
            delaiMaxJours: prix.delaiMaxJours,
          })),
        },
      },
      select: { id: true, numero: true },
    })
    commandes.push({ id: commande.id, numero: commande.numero, artistId, devise, lignes: deLArtiste.length })
  }
  return { ok: true, passageId: passage.id, commandes }
}
