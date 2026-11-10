import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { cloudinary } from '@/lib/cloudinary'
import type { Acteur } from '@/lib/acces'
import { configuration, echapper, memeSignature, signatureReponse, type EnvoiSigne } from './photos'
import { FORMATS_AUTORISES } from './depot-regles'
import {
  estCiblePhotoArtiste,
  lireFicheArtiste,
  TAILLE_MAX_PHOTO_ARTISTE,
  type CiblePhotoArtiste,
} from './fiche-artiste-regles'

// Pages artistes (story 3.11, FR-19, OQ-14) : l'équipe renseigne biographie, démarche, formation,
// expositions, portrait et photo d'atelier. Seul module qui écrit ces colonnes ; admin seulement.
// Photos : envoi direct du navigateur à Cloudinary (jamais par Vercel), signé ici, public_id imposé
// sous errancy/artistes/<id>/, réponse revérifiée (signature) avant toute écriture. Pas d'événement :
// la page se rafraîchit sous 60 s (cache du catalogue).

export type CodeRefusFicheArtiste =
  | 'acces_refuse'
  | 'introuvable'
  | 'valeur_invalide'
  | 'fichier_refuse'
  | 'signature_invalide'
  | 'envoi_indisponible'

export type RefusFicheArtiste = { ok: false; code: CodeRefusFicheArtiste; erreur?: string }

export const MESSAGES_REFUS_FICHE_ARTISTE: Record<CodeRefusFicheArtiste, string> = {
  acces_refuse: 'Seule l’équipe peut modifier la page d’un artiste.',
  introuvable: 'Artiste introuvable.',
  valeur_invalide: 'Valeur refusée : vérifiez les champs.',
  fichier_refuse: 'Ce fichier est refusé : choisissez une photo (JPEG, PNG, HEIC…) de 10 Mo au plus.',
  signature_invalide: 'Envoi impossible : la photo n’a pas pu être vérifiée. Réessayez.',
  envoi_indisponible: 'L’envoi de photos est momentanément indisponible.',
}

export const messageRefusFicheArtiste = (code: CodeRefusFicheArtiste) => MESSAGES_REFUS_FICHE_ARTISTE[code]

/** Dossier Cloudinary des photos d'un artiste. */
export const dossierArtiste = (artistId: string) => `errancy/artistes/${artistId}`

const COLONNE: Record<CiblePhotoArtiste, 'imageUrl' | 'atelierUrl'> = { portrait: 'imageUrl', atelier: 'atelierUrl' }

/* ── Textes ─────────────────────────────────────────────────────────────── */

export type ResultatFicheArtiste =
  | { ok: true; fiche: { bio: string; statement: string | null; formation: string | null; expositions: string | null } }
  | RefusFicheArtiste

/** Enregistre biographie, démarche, formation et expositions. Admin seulement. */
export async function enregistrerFichePublique(acteur: Acteur, artistId: unknown, champs: unknown): Promise<ResultatFicheArtiste> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof artistId !== 'string' || !artistId) return { ok: false, code: 'introuvable' }
  const lue = lireFicheArtiste(champs)
  if (!lue.ok) return { ok: false, code: 'valeur_invalide', erreur: lue.erreur }
  let count: number
  try {
    ;({ count } = await prisma.artist.updateMany({
      where: { id: artistId },
      data: { bio: lue.champs.bio, statement: lue.champs.statement, formation: lue.champs.formation, expositions: lue.champs.expositions },
    }))
  } catch {
    return { ok: false, code: 'valeur_invalide' }
  }
  if (count === 0) return { ok: false, code: 'introuvable' }
  return { ok: true, fiche: lue.champs }
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

export type ResultatEnvoiArtiste = { ok: true; envoi: EnvoiSigne } | RefusFicheArtiste

/**
 * Signature d'un envoi direct vers Cloudinary pour le portrait ou la photo d'atelier d'un artiste.
 * Le client poste exactement `file`, `api_key`, `timestamp`, `public_id`, `allowed_formats` et `signature`.
 */
export async function preparerEnvoiPhotoArtiste(acteur: Acteur, artistId: unknown, cible: unknown): Promise<ResultatEnvoiArtiste> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof artistId !== 'string' || !artistId) return { ok: false, code: 'introuvable' }
  if (!estCiblePhotoArtiste(cible)) return { ok: false, code: 'valeur_invalide' }
  const config = configuration()
  if (!config) return { ok: false, code: 'envoi_indisponible' }
  const artiste = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } })
  if (!artiste) return { ok: false, code: 'introuvable' }

  const folder = dossierArtiste(artiste.id)
  const publicId = `${folder}/${cible}-${randomBytes(4).toString('hex')}`
  const timestamp = Math.floor(Date.now() / 1000)
  const allowedFormats = FORMATS_AUTORISES.image.join(',')
  const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp, allowed_formats: allowedFormats }, config.secret)
  return { ok: true, envoi: { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, publicId, allowedFormats, folder, signature } }
}

export type ResultatPhotoArtiste = { ok: true; cible: CiblePhotoArtiste; url: string } | RefusFicheArtiste

function dimensionValide(octets: unknown): octets is number {
  return typeof octets === 'number' && octets > 0 && octets <= TAILLE_MAX_PHOTO_ARTISTE
}

/** Public_id d'une photo de ce dossier d'après son adresse Cloudinary ; null pour toute autre adresse. */
function publicIdDeLAdresse(url: string | null, artistId: string): string | null {
  if (!url) return null
  const m = new RegExp(`/image/upload/v\\d+/(${echapper(dossierArtiste(artistId))}/(?:portrait|atelier)-[0-9a-f]{8})\\.[a-z0-9]{2,5}$`).exec(url)
  return m ? m[1] : null
}

/**
 * Enregistre le portrait ou la photo d'atelier après l'envoi direct, si la réponse de Cloudinary est
 * authentique (signature recalculée avec le secret), porte le public_id imposé pour cet artiste et
 * cette case, et respecte format et poids. Sinon rien n'est écrit : l'ancienne photo reste.
 */
export async function enregistrerPhotoArtiste(acteur: Acteur, artistId: unknown, cible: unknown, reponse: unknown): Promise<ResultatPhotoArtiste> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof artistId !== 'string' || !artistId) return { ok: false, code: 'introuvable' }
  if (!estCiblePhotoArtiste(cible)) return { ok: false, code: 'valeur_invalide' }
  const config = configuration()
  if (!config) return { ok: false, code: 'envoi_indisponible' }

  const r = (reponse ?? {}) as Record<string, unknown>
  const version = typeof r.version === 'number' || typeof r.version === 'string' ? String(r.version) : ''
  if (typeof r.public_id !== 'string' || typeof r.signature !== 'string' || typeof r.secure_url !== 'string' || !/^\d{1,20}$/.test(version)) {
    return { ok: false, code: 'signature_invalide' }
  }
  const publicId = r.public_id
  if (!memeSignature(signatureReponse(publicId, version, config.secret), r.signature)) return { ok: false, code: 'signature_invalide' }
  if (r.resource_type !== 'image') return { ok: false, code: 'fichier_refuse' }
  // L'adresse n'est pas couverte par la signature : elle doit désigner exactement la ressource signée.
  const adresse = new RegExp(`^https://res\\.cloudinary\\.com/${echapper(config.cloudName)}/image/upload/v${version}/${echapper(publicId)}\\.[a-z0-9]{2,5}$`)
  if (!adresse.test(r.secure_url)) return { ok: false, code: 'signature_invalide' }

  const artiste = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, imageUrl: true, atelierUrl: true } })
  if (!artiste) return { ok: false, code: 'introuvable' }
  // Le public_id doit être celui imposé pour cet artiste et cette case.
  if (!new RegExp(`^${echapper(dossierArtiste(artiste.id))}/${cible}-[0-9a-f]{8}$`).test(publicId)) {
    return { ok: false, code: 'signature_invalide' }
  }
  const colonne = COLONNE[cible]
  const ancienne = artiste[colonne]

  const format = typeof r.format === 'string' ? r.format.toLowerCase() : ''
  if (!FORMATS_AUTORISES.image.includes(format) || !dimensionValide(r.bytes)) {
    // Fichier authentique mais non conforme : refusé, puis supprimé de Cloudinary (jamais l'actuel).
    if (publicIdDeLAdresse(ancienne, artiste.id) !== publicId) await supprimerDeCloudinary(publicId)
    return { ok: false, code: 'fichier_refuse' }
  }
  // HEIC/HEIF : ni les navigateurs ni next/image ne les affichent ; Cloudinary convertit en JPEG à la livraison.
  const url = format === 'heic' || format === 'heif' ? r.secure_url.replace(/\.[a-z0-9]+$/, '.jpg') : r.secure_url

  // Écriture conditionnelle sur l'ancienne valeur : un envoi concurrent ou un artiste supprimé entre-temps
  // ne laisse pas de fichier orphelin du nouvel envoi (supprimé ici), et l'ancienne photo reste.
  let count = 0
  try {
    ;({ count } = await prisma.artist.updateMany({ where: { id: artiste.id, [colonne]: ancienne }, data: { [colonne]: url } }))
  } catch {
    count = 0
  }
  if (count === 0) {
    await supprimerDeCloudinary(publicId)
    return { ok: false, code: 'signature_invalide', erreur: 'Envoi impossible : la photo n’a pas été enregistrée. Réessayez. L’ancienne photo est conservée.' }
  }
  // L'ancienne photo n'est volontairement pas détruite : la page publique reste en cache jusqu'à 60 s
  // et pointerait vers une image supprimée. Fichier orphelin accepté sur Cloudinary.
  return { ok: true, cible, url }
}

// Photo remplacée, ou fichier refusé : supprimé de Cloudinary, au mieux. Un échec laisse un fichier orphelin.
async function supprimerDeCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
  } catch {
    console.warn('[curation] photo d’artiste non supprimée de Cloudinary :', publicId)
  }
}
