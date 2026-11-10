import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { ABONNEMENTS, type Abonnement } from '@/lib/abonnements'
import {
  VERSIONS_EVENEMENTS,
  estNomEvenement,
  evenementValide,
  type EvenementLu,
  type NomEvenement,
  type NouvelEvenement,
} from './catalogue'

// Module evenements (story 3.4, AD-11, AR-9) : journal d'événements (outbox).
//   1. `ecrireEvenement(tx, …)` dans la transaction du changement d'état (annulée avec elle) ;
//   2. après validation et AVANT la réponse, `await repartirApresValidation(ids)` : en Next 14,
//      `revalidateTag` n'est pris en compte que s'il est appelé avant la fin de l'action ou de la
//      route (décision du porteur du 2026-11-06) ; la répartition après la réponse (`after()`)
//      viendra avec la montée de Next.js (story 5.3) ;
//   3. pour chaque abonnement, réclamation atomique (événement, gestionnaire) par insertion
//      conditionnelle AVANT tout effet : un double traitement parallèle n'agit qu'une fois.
// Jamais de donnée personnelle dans un événement ni dans un journal : ids seulement.
// Pas de balayage des échecs (AQ-2 ouverte) : le `revalidate` de 60 s du cache rattrape.

export * from './catalogue'

/** Nom et code de l'erreur (ex. code Prisma `P1001`), jamais son message : il peut contenir une donnée personnelle. */
function resumeErreur(erreur: unknown): { nom: string; code?: string } {
  if (!(erreur instanceof Error)) return { nom: 'inconnue' }
  const code = (erreur as { code?: unknown }).code
  return typeof code === 'string' ? { nom: erreur.name, code } : { nom: erreur.name }
}

/**
 * Écrit l'événement dans la transaction de l'appelant et renvoie son id, à répartir après la
 * validation. Refus (exception, donc transaction annulée) si le nom n'est pas au catalogue ou si la
 * charge n'est pas conforme.
 */
export async function ecrireEvenement(tx: Prisma.TransactionClient, evenement: NouvelEvenement): Promise<string> {
  if (!evenementValide(evenement)) {
    throw new Error(`[evenements] événement refusé : ${String((evenement as { nom?: unknown }).nom)} n’est pas au catalogue ou sa charge est invalide`)
  }
  const ligne = await tx.evenement.create({
    data: { nom: evenement.nom, version: VERSIONS_EVENEMENTS[evenement.nom], charge: evenement.charge },
    select: { id: true },
  })
  return ligne.id
}

async function lireEvenement(id: string): Promise<EvenementLu | null> {
  const ligne = await prisma.evenement.findUnique({ where: { id }, select: { id: true, nom: true, version: true, charge: true } })
  if (!ligne || !estNomEvenement(ligne.nom)) return null
  const lu = { id: ligne.id, nom: ligne.nom, version: ligne.version, charge: ligne.charge }
  return evenementValide(lu) ? (lu as EvenementLu) : null
}

/**
 * Réclamation atomique : insère (événement, gestionnaire) si absent. Vrai pour un seul appelant,
 * même en parallèle (clé primaire composite, ON CONFLICT DO NOTHING).
 */
async function reclamer(evenementId: string, gestionnaire: string): Promise<boolean> {
  const { count } = await prisma.traitementEvenement.createMany({
    data: [{ evenementId, gestionnaire }],
    skipDuplicates: true,
  })
  return count === 1
}

/**
 * Répartit les événements vers leurs gestionnaires et attend la fin. Chaque erreur d'un
 * gestionnaire est journalisée (ids seulement) sans être propagée ; la réclamation reste posée
 * (au plus un traitement), le cache se rattrape par son `revalidate`.
 */
export async function repartir(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      const evenement = await lireEvenement(id)
      if (!evenement) continue
      // Le typage relie chaque nom à ses gestionnaires dans `abonnements.ts` ; ici le nom est dynamique.
      for (const abonnement of ABONNEMENTS[evenement.nom] as Abonnement<NomEvenement>[]) {
        try {
          if (!(await reclamer(evenement.id, abonnement.nom))) continue
          await abonnement.gestionnaire(evenement as never)
        } catch (erreur) {
          console.error('[evenements] gestionnaire en échec', {
            evenement: evenement.id,
            nom: evenement.nom,
            gestionnaire: abonnement.nom,
            erreur: resumeErreur(erreur),
          })
        }
      }
    } catch (erreur) {
      console.error('[evenements] répartition en échec', { evenement: id, erreur: resumeErreur(erreur) })
    }
  }
}

/**
 * À attendre APRÈS la validation de la transaction et avant de répondre (jamais dans une fonction
 * qui reçoit `tx`). Ne lève jamais : l'action de l'utilisateur réussit même si la répartition échoue.
 */
export async function repartirApresValidation(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    await repartir(ids)
  } catch (erreur) {
    console.error('[evenements] répartition en échec', { erreur: resumeErreur(erreur) })
  }
}
