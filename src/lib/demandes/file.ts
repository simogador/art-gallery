import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  ETATS_A_TRAITER,
  ETATS_DEMANDE,
  etatDemandeValide,
  typeDemandeValide,
  type CodeRefusEtatDemande,
  type EtatDemande,
} from './file-regles'

// File des demandes de l'équipe (story 4.6, FR-25, FR-8) : lecture des demandes de visite et de
// sélection et changement d'état, réservés à l'acteur `admin` (relu en base, AD-15). Les coordonnées
// des visiteurs sont rendues à l'administrateur seulement ; jamais dans les journaux.

type Commun = {
  id: string
  etat: EtatDemande
  recueLe: Date
  email: string
  telephone: string | null
  /** Dernier changement d'état : nom de l'auteur (`null` si son compte n'existe plus) et date. */
  changement: { par: string | null; le: Date } | null
}

export type DemandeVisiteLue = Commun & {
  type: 'visite'
  typeVisite: 'distance' | 'atelier'
  /** Œuvre concernée ; `null` si elle a été supprimée. */
  oeuvre: { titre: string; slug: string } | null
  creneaux: Date[]
  fuseau: string
}

export type DemandeSelectionLue = Commun & {
  type: 'selection'
  espace: string
  ambiances: string[]
  precision: string | null
  budgetCentimes: number
}

export type DemandeLue = DemandeVisiteLue | DemandeSelectionLue

export type ResultatFile = { ok: true; demandes: DemandeLue[] } | { ok: false; code: 'acces_refuse' }
export type ResultatChangementEtat = { ok: true } | { ok: false; code: CodeRefusEtatDemande }

/**
 * La file, de la plus ancienne à la plus récente. Par défaut les demandes à traiter (`nouvelle`,
 * `planifiee`) ; avec `traitees`, toutes. Lève une erreur sans détail si la base est indisponible
 * (la page affiche son écran d'erreur ; journal sans donnée personnelle).
 */
export async function fileDesDemandes(acteur: Acteur, options: { traitees?: boolean } = {}): Promise<ResultatFile> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const etats = options.traitees ? [...ETATS_DEMANDE] : [...ETATS_A_TRAITER]
  try {
    const [visites, selections] = await Promise.all([
      prisma.demandeVisite.findMany({
        where: { etat: { in: etats } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { artwork: { select: { title: true, slug: true } } },
      }),
      prisma.demandeSelection.findMany({
        where: { etat: { in: etats } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ])
    const auteurs = [...visites, ...selections].map((d) => d.etatChangePar).filter((id): id is string => !!id)
    const noms = new Map<string, string>()
    if (auteurs.length > 0) {
      const utilisateurs = await prisma.user.findMany({
        where: { id: { in: [...new Set(auteurs)] } },
        select: { id: true, name: true, email: true },
      })
      for (const u of utilisateurs) noms.set(u.id, u.name?.trim() || u.email || u.id)
    }
    const changement = (d: { etatChangePar: string | null; etatChangeLe: Date | null }): Commun['changement'] =>
      d.etatChangeLe ? { par: d.etatChangePar ? (noms.get(d.etatChangePar) ?? null) : null, le: d.etatChangeLe } : null

    const demandes: DemandeLue[] = [
      ...visites.map(
        (d): DemandeVisiteLue => ({
          type: 'visite',
          id: d.id,
          etat: d.etat,
          recueLe: d.createdAt,
          email: d.email,
          telephone: d.telephone,
          changement: changement(d),
          typeVisite: d.type,
          oeuvre: d.artwork ? { titre: d.artwork.title, slug: d.artwork.slug } : null,
          creneaux: d.creneaux,
          fuseau: d.fuseau,
        }),
      ),
      ...selections.map(
        (d): DemandeSelectionLue => ({
          type: 'selection',
          id: d.id,
          etat: d.etat,
          recueLe: d.createdAt,
          email: d.email,
          telephone: d.telephone,
          changement: changement(d),
          espace: d.espace,
          ambiances: d.ambiances,
          precision: d.precision,
          budgetCentimes: d.budgetCentimes,
        }),
      ),
    ].sort((a, b) => a.recueLe.getTime() - b.recueLe.getTime() || a.id.localeCompare(b.id))
    return { ok: true, demandes }
  } catch (erreur) {
    // Nom de l'erreur seulement : un message de la base pourrait citer une valeur saisie.
    console.error('[demandes] lecture de la file impossible', { erreur: erreur instanceof Error ? erreur.name : 'inconnue' })
    throw new Error('file_indisponible')
  }
}

/**
 * Change l'état d'une demande et retient qui et quand (dernier changement seulement). Admin
 * seulement ; état ou type inconnu : `invalide` ; demande absente : `introuvable`, rien de changé.
 * Deux changements simultanés : le dernier enregistré l'emporte.
 */
export async function changerEtatDemande(
  acteur: Acteur,
  type: unknown,
  id: unknown,
  etat: unknown,
): Promise<ResultatChangementEtat> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (!typeDemandeValide(type) || !etatDemandeValide(etat)) return { ok: false, code: 'invalide' }
  if (typeof id !== 'string' || !id) return { ok: false, code: 'introuvable' }
  const data = { etat, etatChangePar: acteur.userId, etatChangeLe: new Date() }
  try {
    const { count } =
      type === 'visite'
        ? await prisma.demandeVisite.updateMany({ where: { id }, data })
        : await prisma.demandeSelection.updateMany({ where: { id }, data })
    return count > 0 ? { ok: true } : { ok: false, code: 'introuvable' }
  } catch (erreur) {
    console.error('[demandes] changement d’état impossible', { type, demande: id, erreur: erreur instanceof Error ? erreur.name : 'inconnue' })
    return { ok: false, code: 'indisponible' }
  }
}
