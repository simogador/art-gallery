'use server'

import { cookies } from 'next/headers'
import { constaterLivraisonAcheteur, preparerEnvoiPhotoReclamation, signalerProbleme, type ErreursReclamation } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { COOKIE_SUIVI } from './cookie'

// « J'ai reçu l'œuvre » (story 8.4, FR-29, AD-14). Le passage est celui du jeton `suivi` du cookie du navigateur,
// jamais un identifiant fourni par le client ; seul le numéro de commande vient du client, et `commandes` vérifie
// qu'il appartient à ce passage. Réponses sans détail technique ; journal sans numéro ni jeton.

export type ReponseReception = { ok: true; message: string } | { ok: false; message: string }

export async function confirmerReception(numero: string): Promise<ReponseReception> {
  const t = fr.suivi.reception
  try {
    const r = await constaterLivraisonAcheteur(cookies().get(COOKIE_SUIVI)?.value, String(numero ?? ''))
    if (r.ok) return { ok: true, message: r.dejaLivree ? t.deja : t.reussi }
    switch (r.code) {
      case 'etat_invalide':
        return { ok: false, message: t.erreurs.etatInvalide }
      case 'preuve_requise':
        return { ok: false, message: t.erreurs.preuveRequise }
      case 'introuvable':
      case 'acces_refuse':
        return { ok: false, message: t.erreurs.introuvable }
      default:
        return { ok: false, message: t.erreurs.indisponible }
    }
  } catch (erreur) {
    console.error('reception_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false, message: t.erreurs.indisponible }
  }
}

// « Signaler un problème » (story 8.5, FR-30). Même règle que la livraison : le passage est celui du jeton `suivi`
// du cookie du navigateur, jamais un identifiant du client ; seul le numéro de commande vient du client et
// `commandes` vérifie qu'il appartient à ce passage. Les photos partent directement à Cloudinary (signature
// serveur) : l'action reçoit seulement leurs réponses, revérifiées par le module. Réponses sans détail technique ;
// journal sans numéro, description ni photo.

export type EnvoiPhoto = { cloudName: string; apiKey: string; timestamp: number; publicId: string; allowedFormats: string; signature: string }
export type ReponsePhoto = { ok: true; envoi: EnvoiPhoto } | { ok: false; message: string }
export type ReponseSignalement = { ok: true; message: string } | { ok: false; message: string; champ?: 'motif' | 'description' | 'photos' }

function messageRefus(code: string): string {
  const t = fr.suivi.reclamation.erreurs
  switch (code) {
    case 'etat_invalide':
      return t.etatInvalide
    case 'delai_echu':
      return t.delaiEchu
    case 'reclamation_deja_traitee':
      return t.dejaTraitee
    case 'introuvable':
      return t.introuvable
    default:
      return t.indisponible
  }
}

function erreurChamp(e: ErreursReclamation): { message: string; champ: 'motif' | 'description' | 'photos' } | null {
  const t = fr.suivi.reclamation.erreurs
  if (e.motif) return { message: t.motif, champ: 'motif' }
  if (e.description) return { message: e.description === 'requis' ? t.descriptionRequise : e.description === 'trop_court' ? t.descriptionTropCourte : t.descriptionTropLongue, champ: 'description' }
  if (e.photos) return { message: e.photos === 'trop' ? t.photosTrop : t.photosInvalides, champ: 'photos' }
  return null
}

export async function preparerPhotoReclamation(numero: string): Promise<ReponsePhoto> {
  try {
    const r = await preparerEnvoiPhotoReclamation(cookies().get(COOKIE_SUIVI)?.value, String(numero ?? ''))
    return r.ok ? { ok: true, envoi: r.envoi } : { ok: false, message: messageRefus(r.code) }
  } catch (erreur) {
    console.error('photo_reclamation_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false, message: fr.suivi.reclamation.erreurs.indisponible }
  }
}

export async function signalerUnProbleme(numero: string, saisie: { motif: string; description: string; photos: unknown[] }): Promise<ReponseSignalement> {
  const t = fr.suivi.reclamation
  try {
    const r = await signalerProbleme(cookies().get(COOKIE_SUIVI)?.value, String(numero ?? ''), {
      motif: saisie?.motif,
      description: saisie?.description,
      photos: Array.isArray(saisie?.photos) ? saisie.photos : undefined,
    })
    if (r.ok) return { ok: true, message: r.dejaOuverte ? t.deja : t.reussi }
    if (r.code === 'invalide') return { ok: false, ...(erreurChamp(r.erreurs) ?? { message: t.erreurs.indisponible }) }
    return { ok: false, message: messageRefus(r.code) }
  } catch (erreur) {
    console.error('reclamation_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false, message: t.erreurs.indisponible }
  }
}
