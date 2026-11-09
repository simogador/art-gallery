import type { MetadataRoute } from 'next'
import { adressesPubliques } from '@/lib/catalogue'
import { maintenanceActive, urlAbsolue } from '@/lib/reglages'

// Story 3.8 : /sitemap.xml passe à côté du middleware (extension dans l'adresse) ; en maintenance
// il ne liste donc rien, pour ne pas révéler les œuvres avant l'ouverture. Ni `public/robots.txt`
// ni MAINTENANCE_MODE ne sont touchés (actes du porteur au lancement). Rendu à la demande.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (maintenanceActive()) return []
  const { oeuvres, artistes } = await adressesPubliques()
  return [
    { url: urlAbsolue('/') },
    { url: urlAbsolue('/galerie') },
    { url: urlAbsolue('/artistes') },
    ...oeuvres.map((o) => ({ url: urlAbsolue(`/galerie/${o.slug}`), lastModified: new Date(o.modifieeLe) })),
    ...artistes.map((a) => ({ url: urlAbsolue(`/artistes/${a.slug}`), lastModified: new Date(a.modifieLe) })),
  ]
}
