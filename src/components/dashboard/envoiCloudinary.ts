// Envoi direct du navigateur vers Cloudinary (stories 2.5 et 3.11) : la signature vient du serveur,
// aucun fichier ne transite par Vercel.

/** Envoi direct du fichier à Cloudinary, avec la progression ; renvoie la réponse JSON ou null. */
export function envoyerACloudinary(
  envoi: { cloudName: string; apiKey: string; timestamp: number; publicId: string; allowedFormats: string; signature: string },
  fichier: File,
  progression: (pourcent: number) => void,
): Promise<unknown | null> {
  return new Promise((resolve) => {
    const corps = new FormData()
    corps.append('file', fichier)
    corps.append('api_key', envoi.apiKey)
    corps.append('timestamp', String(envoi.timestamp))
    corps.append('public_id', envoi.publicId)
    corps.append('allowed_formats', envoi.allowedFormats)
    corps.append('signature', envoi.signature)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(envoi.cloudName)}/auto/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progression(Math.floor((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        resolve(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null)
      } catch {
        resolve(null)
      }
    }
    xhr.onerror = () => resolve(null)
    xhr.onabort = xhr.ontimeout = () => resolve(null)
    xhr.send(corps)
  })
}
