import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { cloudinary } from '@/lib/cloudinary'
import type { Acteur } from '@/lib/acces'
import { artisteDeposant, creerBrouillon, relireDepot, verrouillerDepot, type DepotLu, type OeuvreVerrouillee, type RefusDepot } from './depot'
import { estTypePhoto, FORMATS_AUTORISES, photo, type TypePhoto } from './depot-regles'

// Photos du dépôt (story 2.5) : envoi signé. Le navigateur envoie le fichier directement à
// Cloudinary (jamais par Vercel, limité à 4,5 Mo par requête) avec une signature calculée ici ;
// le secret ne quitte jamais le serveur. Le public_id est imposé sous errancy/oeuvres/<id de l'œuvre>/,
// puis la réponse de Cloudinary est vérifiée (signature et public_id) avant tout enregistrement.

type Configuration = { cloudName: string; apiKey: string; secret: string }

function configuration(): Configuration | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  return cloudName && apiKey && secret ? { cloudName, apiKey, secret } : null
}

/** Dossier Cloudinary des photos d'une œuvre. */
export const dossierOeuvre = (artworkId: string) => `errancy/oeuvres/${artworkId}`

export type EnvoiSigne = {
  cloudName: string
  apiKey: string
  timestamp: number
  publicId: string
  /** Formats acceptés par Cloudinary pour cette case, signés : à poster tels quels (`allowed_formats`). */
  allowedFormats: string
  /** Dossier imposé, déjà inclus dans publicId (affiché, jamais renvoyé à Cloudinary). */
  folder: string
  signature: string
}

export type ResultatEnvoi = { ok: true; slug: string; envoi: EnvoiSigne } | RefusDepot

/**
 * Signature d'un envoi direct vers Cloudinary pour une case photo du dépôt. Sans slug, crée
 * d'abord le brouillon (la photo est souvent le premier geste). Le client poste exactement
 * `file`, `api_key`, `timestamp`, `public_id`, `allowed_formats` et `signature` sur
 * https://api.cloudinary.com/v1_1/<cloudName>/auto/upload.
 */
export async function preparerEnvoiPhoto(acteur: Acteur, slug: string | null, type: unknown): Promise<ResultatEnvoi> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  if (!estTypePhoto(type)) return { ok: false, code: 'fichier_refuse' }
  const config = configuration()
  if (!config) return { ok: false, code: 'envoi_indisponible' }

  return prisma.$transaction(async (tx): Promise<ResultatEnvoi> => {
    let oeuvre: OeuvreVerrouillee
    if (slug === null) {
      oeuvre = await creerBrouillon(tx, artisteId)
    } else {
      const verrou = await verrouillerDepot(tx, acteur, slug)
      if (!verrou.ok) return verrou
      oeuvre = verrou.oeuvre
    }
    const folder = dossierOeuvre(oeuvre.id)
    const publicId = `${folder}/${type}-${randomBytes(4).toString('hex')}`
    const timestamp = Math.floor(Date.now() / 1000)
    // Cloudinary refuse tout autre format (un PDF, par exemple) avant même de stocker le fichier.
    const allowedFormats = FORMATS_AUTORISES[photo(type).nature].join(',')
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp, allowed_formats: allowedFormats },
      config.secret,
    )
    return {
      ok: true,
      slug: oeuvre.slug,
      envoi: { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, publicId, allowedFormats, folder, signature },
    }
  })
}

/** Signature d'une réponse d'envoi Cloudinary : sha1("public_id=…&version=…" + secret), en hexadécimal. */
export function signatureReponse(publicId: string, version: string, secret: string): string {
  return createHash('sha1').update(`public_id=${publicId}&version=${version}${secret}`).digest('hex')
}

function memeSignature(attendue: string, recue: string): boolean {
  const a = Buffer.from(attendue, 'utf8')
  const b = Buffer.from(recue, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function dimension(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isSafeInteger(valeur) && valeur > 0 && valeur <= 1_000_000 ? valeur : null
}

/** Réponse de Cloudinary transmise par le navigateur : non fiable, entièrement revérifiée. */
type ReponseEnvoi = {
  public_id?: unknown
  version?: unknown
  signature?: unknown
  secure_url?: unknown
  resource_type?: unknown
  format?: unknown
  bytes?: unknown
  width?: unknown
  height?: unknown
}

export type ResultatPhoto = { ok: true; depot: DepotLu } | RefusDepot

/**
 * Enregistre la photo d'une case après l'envoi direct, si la réponse de Cloudinary est authentique
 * (signature recalculée avec le secret) et porte le public_id imposé pour cette œuvre et cette case.
 * Remplace la photo précédente de la case (« Remplacer ») ; la photo de face alimente aussi
 * l'ancienne colonne imageUrl.
 */
export async function enregistrerPhoto(
  acteur: Acteur,
  slug: string,
  type: unknown,
  reponse: unknown,
): Promise<ResultatPhoto> {
  if (!artisteDeposant(acteur)) return { ok: false, code: 'acces_refuse' }
  if (!estTypePhoto(type)) return { ok: false, code: 'fichier_refuse' }
  const config = configuration()
  if (!config) return { ok: false, code: 'envoi_indisponible' }
  const r = (reponse ?? {}) as ReponseEnvoi
  const version = typeof r.version === 'number' || typeof r.version === 'string' ? String(r.version) : ''
  if (
    typeof r.public_id !== 'string' ||
    typeof r.signature !== 'string' ||
    typeof r.secure_url !== 'string' ||
    !/^\d{1,20}$/.test(version)
  ) {
    return { ok: false, code: 'signature_invalide' }
  }
  const publicId = r.public_id
  if (!memeSignature(signatureReponse(publicId, version, config.secret), r.signature)) {
    return { ok: false, code: 'signature_invalide' }
  }
  const nature = photo(type).nature
  if (r.resource_type !== nature) return { ok: false, code: 'fichier_refuse' }
  // L'adresse n'est pas couverte par la signature : elle doit désigner exactement la ressource signée.
  const adresse = new RegExp(
    `^https://res\\.cloudinary\\.com/${echapper(config.cloudName)}/${nature}/upload/v${version}/${echapper(publicId)}\\.[a-z0-9]{2,5}$`,
  )
  if (!adresse.test(r.secure_url)) return { ok: false, code: 'signature_invalide' }
  // Format et poids revérifiés : le navigateur ne les contrôle qu'à titre indicatif.
  const format = typeof r.format === 'string' ? r.format.toLowerCase() : ''
  const conforme =
    FORMATS_AUTORISES[nature].includes(format) &&
    typeof r.bytes === 'number' &&
    r.bytes > 0 &&
    r.bytes <= photo(type).tailleMaxOctets
  // HEIC/HEIF : ni les navigateurs ni next/image ne les affichent ; Cloudinary convertit en JPEG à la livraison.
  const url = format === 'heic' || format === 'heif' ? r.secure_url.replace(/\.[a-z0-9]+$/, '.jpg') : r.secure_url

  const resultat = await prisma.$transaction(async (tx) => {
    const verrou = await verrouillerDepot(tx, acteur, slug)
    if (!verrou.ok) return { resultat: verrou, aSupprimer: null }
    const oeuvre = verrou.oeuvre
    // Le public_id doit être celui imposé pour cette œuvre et cette case.
    if (!new RegExp(`^${echapper(dossierOeuvre(oeuvre.id))}/${type}-[0-9a-f]{8}$`).test(publicId)) {
      return { resultat: { ok: false, code: 'signature_invalide' } as const, aSupprimer: null }
    }
    const precedente = await tx.photoOeuvre.findUnique({
      where: { artworkId_type: { artworkId: oeuvre.id, type } },
      select: { publicId: true },
    })
    // Fichier authentique de ce brouillon mais non conforme : refusé, puis supprimé de Cloudinary
    // (jamais la photo déjà enregistrée, si la réponse rejouée est la sienne).
    if (!conforme) {
      const aSupprimer = precedente?.publicId === publicId ? null : publicId
      return { resultat: { ok: false, code: 'fichier_refuse' } as const, aSupprimer }
    }
    const champs = { url, publicId, largeur: dimension(r.width), hauteur: dimension(r.height) }
    await tx.photoOeuvre.upsert({
      where: { artworkId_type: { artworkId: oeuvre.id, type } },
      create: { artworkId: oeuvre.id, type, ...champs },
      update: champs,
    })
    if (type === 'face_lumiere_du_jour') {
      await tx.artwork.update({ where: { id: oeuvre.id }, data: { imageUrl: url } })
    }
    const aSupprimer = precedente && precedente.publicId !== publicId ? precedente.publicId : null
    return { resultat: { ok: true, depot: await relireDepot(tx, oeuvre.id) } as const, aSupprimer }
  })

  if (resultat.aSupprimer) await supprimerAncienne(resultat.aSupprimer, type)
  return resultat.resultat
}

// Photo remplacée, ou fichier refusé : supprimé de Cloudinary, au mieux. Un échec laisse un fichier orphelin, sans
// effet sur le dépôt.
async function supprimerAncienne(publicId: string, type: TypePhoto): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: photo(type).nature, invalidate: true })
  } catch {
    console.warn('[curation] photo remplacée non supprimée de Cloudinary :', publicId)
  }
}
