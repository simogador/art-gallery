import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  consommerJetonDesinscription,
  emettreJetonDesinscription,
  lienDesinscriptionBienForme,
  revoquerJetonDesinscription,
} from '@/lib/acces/desinscription'

// Annonce de l'ouverture (FR-35, story 4.9) : lecture des contacts laissés sur la page de maintenance
// et retrait d'un contact. Tout ce qui lit la liste est réservé à l'acteur `admin` (rôle relu en base,
// AD-15). Les adresses ne sont jamais journalisées. Un contact n'est plus dans la liste dès que son
// e-mail est parti (son adresse est supprimée) ou qu'il s'est désinscrit.

export type ContactAPrevenir = { id: string; email: string }
export type ResultatContacts = { ok: true; contacts: ContactAPrevenir[] } | { ok: false; code: 'acces_refuse' }
export type ResultatNombre = { ok: true; nombre: number } | { ok: false; code: 'acces_refuse' }

/** Contacts à prévenir, du plus ancien au plus récent consentement. */
export async function contactsAPrevenir(acteur: Acteur): Promise<ResultatContacts> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const contacts = await prisma.inscriptionOuverture.findMany({
    orderBy: [{ consentementLe: 'asc' }, { id: 'asc' }],
    select: { id: true, email: true },
  })
  return { ok: true, contacts }
}

export async function nombreContactsAPrevenir(acteur: Acteur): Promise<ResultatNombre> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  return { ok: true, nombre: await prisma.inscriptionOuverture.count() }
}

/**
 * Émet le lien de désinscription d'un contact, juste avant l'envoi de son e-mail. Réservé à l'annonce
 * (l'acteur admin y est déjà vérifié) ; null si le contact n'existe plus (désinscrit entre-temps) ou
 * si un envoi est déjà en cours pour lui.
 */
export async function preparerDesinscription(contactId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    // Verrou de la ligne : deux annonces simultanées ne préparent pas deux envois pour le même contact.
    const lignes = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "InscriptionOuverture" WHERE "id" = ${contactId} FOR UPDATE`
    if (lignes.length === 0) return null
    return emettreJetonDesinscription(tx, contactId)
  })
}

/** L'e-mail est parti : l'adresse est supprimée (le lien de désinscription reste valable). */
export async function retirerContactPrevenu(contactId: string): Promise<void> {
  await prisma.inscriptionOuverture.deleteMany({ where: { id: contactId } })
}

/** L'e-mail n'est pas parti : l'adresse reste, le lien émis est révoqué. */
export async function abandonnerDesinscription(contactId: string): Promise<void> {
  await prisma.$transaction((tx) => revoquerJetonDesinscription(tx, contactId))
}

/**
 * Désinscription par le lien de l'e-mail (page publique) : le jeton est consommé une seule fois et
 * l'adresse, si elle est encore là, est supprimée. `true` seulement si le lien était utilisable.
 */
export async function desinscrire(jeton: string): Promise<boolean> {
  if (!lienDesinscriptionBienForme(jeton)) return false
  return prisma.$transaction(async (tx) => {
    const contactId = await consommerJetonDesinscription(tx, jeton)
    if (!contactId) return false
    await tx.inscriptionOuverture.deleteMany({ where: { id: contactId } })
    return true
  })
}
