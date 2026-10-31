import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { LONGUEUR_MAX_NOM, type RefusZone } from './messages'
import { estCodePays, trierParNom } from './pays'

// Module livraison (AD-12, story 2.3) : seul module qui lit et écrit les zones de livraison et
// leurs pays. Les zones sont des données gérées par l'équipe (OQ-5), jamais codées en dur.
// Les offres par œuvre et par zone (OffreLivraison) seront saisies en story 2.6.

export { CODES_PAYS, estCodePays, nomPays, trierParNom } from './pays'
export { LONGUEUR_MAX_NOM, messageRefusZone, type RefusZone } from './messages'

export type ZoneLue = { id: string; nom: string; pays: string[]; offres: number }

export type ResultatZone = { ok: true; id: string } | RefusZone

/** Zones dans leur ordre de création, pays triés par nom français, avec leur nombre d'offres. */
export async function listerZones(): Promise<ZoneLue[]> {
  const zones = await prisma.zone.findMany({
    orderBy: [{ createdAt: 'asc' }, { nom: 'asc' }],
    select: { id: true, nom: true, pays: { select: { codePays: true } }, _count: { select: { offres: true } } },
  })
  return zones.map((z) => ({
    id: z.id,
    nom: z.nom,
    pays: trierParNom(z.pays.map((p) => p.codePays)),
    offres: z._count.offres,
  }))
}

export async function lireZone(id: string): Promise<ZoneLue | null> {
  return (await listerZones()).find((z) => z.id === id) ?? null
}

/** Zone de chaque pays attribué : code pays → nom de la zone. */
export async function attributionsPays(): Promise<Record<string, { zoneId: string; zone: string }>> {
  const lignes = await prisma.zonePays.findMany({ select: { codePays: true, zoneId: true, zone: { select: { nom: true } } } })
  return Object.fromEntries(lignes.map((l) => [l.codePays, { zoneId: l.zoneId, zone: l.zone.nom }]))
}

type Saisie = { nom: string; pays: string[] }

function normaliserNom(nom: string): string {
  return nom.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function valider(saisie: Saisie): { nom: string; pays: string[] } | RefusZone {
  const nom = normaliserNom(saisie.nom)
  if (!nom || nom.length > LONGUEUR_MAX_NOM) return { ok: false, code: 'nom_invalide' }
  const pays = [...new Set(saisie.pays.map((p) => p.trim().toUpperCase()).filter(Boolean))]
  const inconnus = pays.filter((p) => !estCodePays(p))
  if (inconnus.length) return { ok: false, code: 'pays_inconnu', pays: inconnus }
  return { nom, pays }
}

function codeErreur(erreur: unknown): string | undefined {
  return (erreur as { code?: string } | null)?.code
}

/**
 * Refus correspondant à une violation d'unicité (P2002) survenue malgré les vérifications : un autre
 * admin a pris le même nom ou le même pays entre-temps. Avec l'adaptateur pg (Prisma 7), la table en
 * cause est dans `meta.driverAdapterError.cause.table` (ou `meta.modelName`), sans `meta.target`.
 */
export function refusSurConflit(erreur: unknown): RefusZone | null {
  if (codeErreur(erreur) !== 'P2002') return null
  const meta = (erreur as { meta?: { modelName?: string; driverAdapterError?: { cause?: { table?: string } } } }).meta
  const table = meta?.driverAdapterError?.cause?.table ?? meta?.modelName
  return table === 'Zone' ? { ok: false, code: 'nom_pris' } : { ok: false, code: 'pays_deja_pris', pays: [] }
}

/** Crée une zone (réservé aux admins). Un pays déjà dans une autre zone est refusé. */
export function creerZone(acteur: Acteur, saisie: Saisie): Promise<ResultatZone> {
  return enregistrer(acteur, null, saisie)
}

/** Renomme une zone et remplace sa liste de pays (réservé aux admins), en une transaction. */
export function modifierZone(acteur: Acteur, id: string, saisie: Saisie): Promise<ResultatZone> {
  return enregistrer(acteur, id, saisie)
}

async function enregistrer(acteur: Acteur, id: string | null, saisie: Saisie): Promise<ResultatZone> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const valide = valider(saisie)
  if ('ok' in valide) return valide
  const { nom, pays } = valide

  try {
    return await prisma.$transaction(async (tx): Promise<ResultatZone> => {
      if (id && !(await tx.zone.findUnique({ where: { id }, select: { id: true } }))) {
        return { ok: false, code: 'introuvable' }
      }
      const homonyme = await tx.zone.findFirst({
        where: { nom: { equals: nom, mode: 'insensitive' }, ...(id ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (homonyme) return { ok: false, code: 'nom_pris' }

      const pris = await tx.zonePays.findMany({
        where: { codePays: { in: pays }, ...(id ? { NOT: { zoneId: id } } : {}) },
        select: { codePays: true, zone: { select: { nom: true } } },
      })
      if (pris.length) {
        return {
          ok: false,
          code: 'pays_deja_pris',
          pays: trierParNom(pris.map((p) => p.codePays)).map((code) => ({
            code,
            zone: pris.find((p) => p.codePays === code)!.zone.nom,
          })),
        }
      }

      const zone = id
        ? await tx.zone.update({ where: { id }, data: { nom }, select: { id: true } })
        : await tx.zone.create({ data: { nom }, select: { id: true } })
      await tx.zonePays.deleteMany({ where: { zoneId: zone.id, codePays: { notIn: pays } } })
      // Sans skipDuplicates : un pays pris entre-temps par une autre zone fait échouer la transaction
      // (P2002) au lieu d'être ignoré en silence.
      const deja = new Set(
        (await tx.zonePays.findMany({ where: { zoneId: zone.id }, select: { codePays: true } })).map((p) => p.codePays),
      )
      await tx.zonePays.createMany({ data: pays.filter((c) => !deja.has(c)).map((codePays) => ({ codePays, zoneId: zone.id })) })
      return { ok: true, id: zone.id }
    })
  } catch (erreur) {
    const conflit = refusSurConflit(erreur)
    if (conflit) return conflit
    // Zone supprimée par un autre admin pendant la modification.
    if (codeErreur(erreur) === 'P2025' || codeErreur(erreur) === 'P2003') return { ok: false, code: 'introuvable' }
    throw erreur
  }
}

/** Supprime une zone et ses pays (réservé aux admins) ; refusé si une offre l'utilise. */
export async function supprimerZone(acteur: Acteur, id: string): Promise<ResultatZone> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const zone = await prisma.zone.findUnique({ where: { id }, select: { _count: { select: { offres: true } } } })
  if (!zone) return { ok: false, code: 'introuvable' }
  if (zone._count.offres > 0) return { ok: false, code: 'zone_utilisee', offres: zone._count.offres }
  try {
    await prisma.zone.delete({ where: { id } })
    return { ok: true, id }
  } catch (erreur) {
    // Offre créée entre la vérification et la suppression : la clé étrangère (RESTRICT) refuse.
    if (codeErreur(erreur) === 'P2003') {
      const offres = await prisma.offreLivraison.count({ where: { zoneId: id } })
      return { ok: false, code: 'zone_utilisee', offres }
    }
    if (codeErreur(erreur) === 'P2025') return { ok: false, code: 'introuvable' }
    throw erreur
  }
}
