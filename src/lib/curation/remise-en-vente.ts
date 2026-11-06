import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { cloreDeclarationRetrait, disponibiliteRemiseEnVente, remiseEnVentePossible, type Publication } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { artisteDeposant, verrouillerOeuvre } from './depot'

// « Remettre en vente » (story 2.8, FR-21) : une œuvre publiée puis retirée par son artiste repasse
// en curation (`en_curation`, nouvelle date d'envoi), où l'équipe la revalide (story 2.7). L'axe
// disponibilité redevient `disponible`, valeur fournie par le module disponibilite.

type CodeRefusRemise = 'acces_refuse' | 'introuvable' | 'transition_interdite'

export type ResultatRemiseEnVente = { ok: true; slug: string } | { ok: false; code: CodeRefusRemise }

// Refus du verrou de dépôt traduits un à un ; tout autre code (imprévu) devient transition_interdite.
function codeRemise(code: string): CodeRefusRemise {
  switch (code) {
    case 'acces_refuse':
    case 'introuvable':
      return code
    default:
      return 'transition_interdite'
  }
}

/**
 * Artiste propriétaire seulement, sur la ligne verrouillée. Refus, sans rien écrire : `acces_refuse`
 * (autre artiste), `introuvable`, `transition_interdite` (œuvre qui n'est pas publiée et retirée).
 */
export async function remettreEnVente(acteur: Acteur, slug: unknown): Promise<ResultatRemiseEnVente> {
  if (!artisteDeposant(acteur)) return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  const evenements: string[] = []
  const resultat = await prisma.$transaction(async (tx): Promise<ResultatRemiseEnVente> => {
    const verrou = await verrouillerOeuvre(tx, acteur, slug, remiseEnVentePossible)
    if (!verrou.ok) return { ok: false, code: codeRemise(verrou.code) }
    const publication: Publication = 'en_curation'
    const maintenant = new Date()
    await tx.artwork.update({
      where: { id: verrou.oeuvre.id },
      data: { publication, envoyeeEnCurationLe: maintenant, ...disponibiliteRemiseEnVente() },
    })
    // La déclaration « retirée » n'est plus en vigueur (écrite par le module disponibilite).
    await cloreDeclarationRetrait(tx, verrou.oeuvre.id, maintenant)
    // Les deux axes changent : publication (retour en curation) et disponibilité (de nouveau disponible).
    const charge = { artworkId: verrou.oeuvre.id, artistId: artisteDeposant(acteur) as string }
    evenements.push(await ecrireEvenement(tx, { nom: 'PublicationChangee', charge }))
    evenements.push(await ecrireEvenement(tx, { nom: 'DisponibiliteChangee', charge }))
    return { ok: true, slug: verrou.oeuvre.slug }
  })
  if (resultat.ok) await repartirApresValidation(evenements)
  return resultat
}
