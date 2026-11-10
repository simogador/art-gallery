import { prisma } from '@/lib/prisma'
import type { CodeRefusSelection } from './selection-regles'
import type { Acteur } from '@/lib/acces'
import { lireEtatVerrouille, estPubliee, estRetiree } from '@/lib/disponibilite'

// Sélection de l'équipe (FR-18, story 3.10) : le marqueur `Artwork.featured` (« Coup de cœur » sur la
// fiche) est la seule sélection de l'accueil, écrit seulement ici. Pas d'événement : le choix apparaît
// sur l'accueil au plus 60 s plus tard (cache du catalogue, accepté en 3.4).

export type { CodeRefusSelection } from './selection-regles'
export { MESSAGES_REFUS_SELECTION } from './selection-regles'

export type ResultatSelection = { ok: true } | { ok: false; code: CodeRefusSelection }

/**
 * Marque (`marquee`) ou démarque une œuvre de la sélection de l'accueil ; réservé aux admins, sur la
 * ligne verrouillée. Pour marquer, l'œuvre doit être publiée (`non_publiee` sinon : brouillon ou en
 * curation) et non retirée (`retiree`). Démarquer reste possible tant que l'œuvre existe, pour qu'une
 * œuvre retirée ne garde pas un marqueur périmé.
 */
export async function definirSelection(acteur: Acteur, slug: unknown, marquee: boolean): Promise<ResultatSelection> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  return prisma.$transaction(async (tx): Promise<ResultatSelection> => {
    const actuel = await lireEtatVerrouille(tx, slug)
    if (!actuel) return { ok: false, code: 'introuvable' }
    if (marquee) {
      if (estRetiree(actuel)) return { ok: false, code: 'retiree' }
      if (!estPubliee(actuel)) return { ok: false, code: 'non_publiee' }
    }
    await tx.artwork.update({ where: { slug }, data: { featured: marquee } })
    return { ok: true }
  })
}
