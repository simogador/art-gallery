import { prisma } from '@/lib/prisma'
import { ARTISTE_VISIBLE, VISIBLE } from '@/lib/disponibilite'
import { enCache, ETIQUETTE_CATALOGUE } from './cache'

// Story 3.8 : adresses publiques pour le sitemap. Mêmes règles de visibilité que le catalogue
// (`VISIBLE` : publiées, non retirées, artiste avec accord signé et actif ; `ARTISTE_VISIBLE`) ;
// les œuvres vendues y sont, les retirées non. En cache (60 s, étiquette du catalogue). Les dates
// reviennent du cache en texte ISO.

export type AdressesPubliques = {
  oeuvres: { slug: string; modifieeLe: string }[]
  artistes: { slug: string; modifieLe: string }[]
}

export async function adressesPubliques(): Promise<AdressesPubliques> {
  return enCache(['adresses-publiques'], [ETIQUETTE_CATALOGUE], async () => {
    const [oeuvres, artistes] = await Promise.all([
      prisma.artwork.findMany({
        where: VISIBLE,
        orderBy: { slug: 'asc' },
        select: { slug: true, updatedAt: true },
      }),
      prisma.artist.findMany({
        where: ARTISTE_VISIBLE,
        orderBy: { slug: 'asc' },
        select: { slug: true, updatedAt: true },
      }),
    ])
    return {
      oeuvres: oeuvres.map((o) => ({ slug: o.slug, modifieeLe: o.updatedAt.toISOString() })),
      artistes: artistes.map((a) => ({ slug: a.slug, modifieLe: a.updatedAt.toISOString() })),
    }
  })
}
