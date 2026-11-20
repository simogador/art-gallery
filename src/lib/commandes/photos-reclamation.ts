import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cloudinary } from '@/lib/cloudinary'
import { FORMATS_PHOTO_RECLAMATION, PHOTOS_RECLAMATION } from './reclamation-regles'

// Photos d'une réclamation (story 8.5, décision 1A) : envoi direct du navigateur à Cloudinary, signé ici (le secret
// ne quitte jamais le serveur), jamais de fichier par Vercel. Le `public_id` est imposé sous
// `errancy/reclamations/<id de la commande>/`, puis la réponse de Cloudinary, transmise par le navigateur et donc
// non fiable, est entièrement revérifiée (signature, public_id, adresse, format, poids) avant tout enregistrement.
// Pas d'accès à la base ici. `commandes` n'importe pas `curation` : la mécanique de signature est reprise.

type Configuration = { cloudName: string; apiKey: string; secret: string }

function configuration(): Configuration | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  return cloudName && apiKey && secret ? { cloudName, apiKey, secret } : null
}

export const dossierReclamation = (commandeId: string) => `errancy/reclamations/${commandeId}`

export type EnvoiPhotoSigne = {
  cloudName: string
  apiKey: string
  timestamp: number
  publicId: string
  allowedFormats: string
  signature: string
}

/** Signature d'un envoi direct pour UNE photo de la commande ; null si Cloudinary n'est pas configuré. */
export function signerEnvoiPhoto(commandeId: string): EnvoiPhotoSigne | null {
  const config = configuration()
  if (!config) return null
  const publicId = `${dossierReclamation(commandeId)}/photo-${randomBytes(4).toString('hex')}`
  const timestamp = Math.floor(Date.now() / 1000)
  const allowedFormats = FORMATS_PHOTO_RECLAMATION.join(',')
  const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp, allowed_formats: allowedFormats }, config.secret)
  return { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, publicId, allowedFormats, signature }
}

/** Signature d'une réponse d'envoi Cloudinary : sha1("public_id=…&version=…" + secret), en hexadécimal. */
function signatureReponse(publicId: string, version: string, secret: string): string {
  return createHash('sha1').update(`public_id=${publicId}&version=${version}${secret}`).digest('hex')
}

function memeSignature(attendue: string, recue: string): boolean {
  const a = Buffer.from(attendue, 'utf8')
  const b = Buffer.from(recue, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export type PhotoVerifiee = { url: string; publicId: string }

/**
 * Vérifie les réponses de Cloudinary d'un signalement : au plus 3, toutes authentiques (signature recalculée avec
 * le secret), au `public_id` imposé pour cette commande, à l'adresse qui désigne exactement la ressource signée,
 * images de format accepté et de 5 Mo au plus, sans doublon. Une seule photo refusée refuse le tout (`invalide`).
 */
export function verifierPhotos(commandeId: string, reponses: unknown): { ok: true; photos: PhotoVerifiee[] } | { ok: false; code: 'trop' | 'invalide' | 'indisponible' } {
  const liste = reponses === undefined || reponses === null ? [] : reponses
  if (!Array.isArray(liste)) return { ok: false, code: 'invalide' }
  if (liste.length > PHOTOS_RECLAMATION.max) return { ok: false, code: 'trop' }
  if (liste.length === 0) return { ok: true, photos: [] }
  const config = configuration()
  if (!config) return { ok: false, code: 'indisponible' }
  const motif = new RegExp(`^${echapper(dossierReclamation(commandeId))}/photo-[0-9a-f]{8}$`)
  const photos: PhotoVerifiee[] = []
  for (const brute of liste) {
    const r = (brute ?? {}) as Record<string, unknown>
    const version = typeof r.version === 'number' || typeof r.version === 'string' ? String(r.version) : ''
    if (typeof r.public_id !== 'string' || typeof r.signature !== 'string' || typeof r.secure_url !== 'string' || !/^\d{1,20}$/.test(version)) return { ok: false, code: 'invalide' }
    const publicId = r.public_id
    if (!memeSignature(signatureReponse(publicId, version, config.secret), r.signature)) return { ok: false, code: 'invalide' }
    if (!motif.test(publicId) || r.resource_type !== 'image') return { ok: false, code: 'invalide' }
    // L'adresse n'est pas couverte par la signature : elle doit désigner exactement la ressource signée.
    const adresse = new RegExp(`^https://res\\.cloudinary\\.com/${echapper(config.cloudName)}/image/upload/v${version}/${echapper(publicId)}\\.[a-z0-9]{2,5}$`)
    if (!adresse.test(r.secure_url)) return { ok: false, code: 'invalide' }
    const format = typeof r.format === 'string' ? r.format.toLowerCase() : ''
    if (!(FORMATS_PHOTO_RECLAMATION as readonly string[]).includes(format)) return { ok: false, code: 'invalide' }
    if (typeof r.bytes !== 'number' || !(r.bytes > 0) || r.bytes > PHOTOS_RECLAMATION.octetsMax) return { ok: false, code: 'invalide' }
    if (photos.some((p) => p.publicId === publicId)) return { ok: false, code: 'invalide' }
    // HEIC/HEIF : ni les navigateurs ni next/image ne les affichent ; Cloudinary convertit en JPEG à la livraison.
    const url = format === 'heic' || format === 'heif' ? r.secure_url.replace(/\.[a-z0-9]+$/, '.jpg') : r.secure_url
    photos.push({ url, publicId })
  }
  return { ok: true, photos }
}
