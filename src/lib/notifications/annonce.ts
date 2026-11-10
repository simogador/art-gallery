import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  abandonnerDesinscription,
  contactsAPrevenir,
  nombreContactsAPrevenir,
  preparerDesinscription,
  retirerContactPrevenu,
} from '@/lib/demandes'
import { DUREE_MAX_ANNONCE_SECONDES, ECHECS_CONSECUTIFS_MAX, PAUSE_ENTRE_ENVOIS_MS, urlAbsolue } from '@/lib/reglages'
import { envoiActif, envoiReel } from './choix'
import { contenuOuverture } from './contenus'
import type { Courriel, ResultatEnvoi } from './port'

// Annonce de l'ouverture aux contacts de la maintenance (FR-35, story 4.9). Déclenchée par un geste
// de l'administrateur, jamais programmée ni répétée. Un e-mail par contact, par le port d'envoi (4.1) :
// le contact est « prévenu » quand le port a accepté son e-mail, et son adresse est alors supprimée ;
// un second envoi ne touche donc que les contacts restants. Hors production (adaptateur « journal »,
// qui répond « ok » sans rien envoyer), l'annonce est refusée : aucune adresse ne serait à supprimer.
// Journaux : ids seulement, jamais d'adresse.

export type BilanAnnonce = {
  prevenus: number
  echecs: number
  /** Contacts encore dans la liste après l'envoi (échecs, non atteints, envois en cours). */
  restants: number
  /** Prévenus dont l'adresse n'a pas pu être supprimée : à retirer avant tout nouvel envoi. */
  aSupprimer: number
  /** L'envoi s'est arrêté après une série d'échecs consécutifs. */
  arretEchecs: boolean
}
export type ResultatAnnonce =
  | { ok: true; bilan: BilanAnnonce }
  | { ok: false; code: 'acces_refuse' | 'hors_production' | 'indisponible' }
export type ResultatEssai = { ok: true; reel: boolean } | { ok: false; code: 'acces_refuse' | 'adresse_absente' | 'envoi_echoue' }

const TENTATIVES_SUPPRESSION = 3

async function envoyer(courriel: Courriel): Promise<ResultatEnvoi> {
  try {
    return await envoiActif().envoyer(courriel)
  } catch {
    return { ok: false, code: 'indisponible' }
  }
}

// Clé d'idempotence d'un envoi : le contact et le lien émis (par son empreinte, jamais sa valeur). Un
// nouvel essai après échec émet un nouveau lien, donc une nouvelle clé : le prestataire ne rejette pas
// le corps modifié ; le même envoi rejoué avec le même lien reste dédoublonné.
function empreinteCourte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex').slice(0, 16)
}

/** Supprime l'adresse d'un contact prévenu, en trois tentatives ; faux si elle reste malgré l'envoi. */
async function supprimerApresEnvoi(contactId: string): Promise<boolean> {
  for (let essai = 1; essai <= TENTATIVES_SUPPRESSION; essai++) {
    try {
      await retirerContactPrevenu(contactId)
      return true
    } catch {
      // nouvel essai
    }
  }
  console.error('[notifications] adresse non supprimée après l’annonce', { contact: contactId })
  return false
}

export type OptionsAnnonce = {
  /** Nombre de contacts confirmé par l'administrateur : seuls les `max` plus anciens sont traités. */
  max?: number
  /** Horloge (tests). */
  maintenant?: () => number
  /** Pause entre deux envois, en ms (nulle en test). */
  pause?: number
}

/**
 * Annonce l'ouverture aux `max` plus anciens contacts encore dans la liste, un par un, dans la limite
 * de temps `DUREE_MAX_ANNONCE_SECONDES` et avec une pause entre deux envois ; s'arrête après
 * `ECHECS_CONSECUTIFS_MAX` échecs de suite. Les contacts non atteints restent à prévenir. Un échec
 * n'interrompt pas les suivants. Admin seulement (rôle relu en base) et envoi réel seulement.
 */
export async function annoncerOuverture(acteur: Acteur, options: OptionsAnnonce = {}): Promise<ResultatAnnonce> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (!envoiReel()) return { ok: false, code: 'hors_production' }
  const horloge = options.maintenant ?? Date.now
  const pause = options.pause ?? PAUSE_ENTRE_ENVOIS_MS
  const liste = await contactsAPrevenir(acteur)
  if (!liste.ok) return { ok: false, code: 'acces_refuse' }
  const contacts = options.max === undefined ? liste.contacts : liste.contacts.slice(0, Math.max(0, options.max))

  const limite = horloge() + DUREE_MAX_ANNONCE_SECONDES * 1000
  let prevenus = 0
  let echecs = 0
  let aSupprimer = 0
  let consecutifs = 0
  let arretEchecs = false
  let tentes = 0
  for (const contact of contacts) {
    if (horloge() >= limite) break
    if (consecutifs >= ECHECS_CONSECUTIFS_MAX) {
      arretEchecs = true
      break
    }
    if (tentes > 0 && pause > 0) await new Promise((resolve) => setTimeout(resolve, pause))
    try {
      const jeton = await preparerDesinscription(contact.id)
      // Contact désinscrit entre-temps (ou envoi déjà en cours) : rien à envoyer, ni prévenu ni en échec.
      if (!jeton) continue
      tentes += 1
      const contenu = contenuOuverture({ lien: urlAbsolue('/'), lienDesinscription: urlAbsolue(`/auth/desinscription/${jeton}`) })
      const resultat = await envoyer({ a: contact.email, ...contenu, cle: `ouverture:${contact.id}:${empreinteCourte(jeton)}` })
      if (resultat.ok) {
        // L'e-mail est parti : le contact est prévenu, quoi qu'il arrive à la suppression, et son lien reste valable.
        prevenus += 1
        consecutifs = 0
        if (!(await supprimerApresEnvoi(contact.id))) aSupprimer += 1
      } else {
        echecs += 1
        consecutifs += 1
        console.error('[notifications] annonce d’ouverture non envoyée', { contact: contact.id, code: resultat.code })
        await abandonnerDesinscription(contact.id)
      }
    } catch {
      // Base indisponible au milieu de l'envoi : le contact compte en échec, les suivants sont tentés.
      echecs += 1
      consecutifs += 1
      console.error('[notifications] annonce d’ouverture interrompue pour un contact', { contact: contact.id })
      try {
        await abandonnerDesinscription(contact.id)
      } catch {
        // Le jeton non révoqué n'est parti dans aucun e-mail : il expirera.
      }
    }
  }

  // `restants` : toujours dans la liste ; si la base ne répond plus, le calcul local, pour ne pas
  // perdre le bilan d'un envoi déjà parti.
  let restants = liste.contacts.length - (prevenus - aSupprimer)
  try {
    const reste = await nombreContactsAPrevenir(acteur)
    if (reste.ok) restants = reste.nombre
  } catch {
    // calcul local conservé
  }
  return { ok: true, bilan: { prevenus, echecs, restants, aSupprimer, arretEchecs } }
}

/**
 * Envoi d'essai : le même e-mail, à l'adresse de l'administrateur connecté (lue en base), jamais à
 * un contact et sans rien écrire dans la liste. Le lien de désinscription est factice : inutilisable.
 * Hors production, l'e-mail ne part pas (`reel` faux : son contenu est dans le journal).
 */
export async function envoyerEssaiOuverture(acteur: Acteur, options: { cle?: string } = {}): Promise<ResultatEssai> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const utilisateur = await prisma.user.findUnique({ where: { id: acteur.userId }, select: { email: true } })
  const adresse = utilisateur?.email
  if (!adresse) return { ok: false, code: 'adresse_absente' }
  const contenu = contenuOuverture({ lien: urlAbsolue('/'), lienDesinscription: urlAbsolue('/auth/desinscription/essai') })
  const cle = options.cle ?? `essai-ouverture:${acteur.userId}:${Date.now()}`
  const resultat = await envoyer({ a: adresse, ...contenu, cle })
  if (!resultat.ok) {
    console.error('[notifications] essai d’ouverture non envoyé', { code: resultat.code })
    return { ok: false, code: 'envoi_echoue' }
  }
  return { ok: true, reel: envoiReel() }
}
