import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

// Limite d'envoi par IP sur des empreintes salées de `TentativeInscription` (table du module demandes),
// pour les formulaires d'autres modules (story 7.3 : coordonnées de l'acheteur sans compte). Jamais l'IP
// en clair. Même modèle que `/conseil` et `/visite` : on compte les envois valides, on refuse au-delà du seuil.

function empreinte(type: string, valeur: string): string {
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

/**
 * Enregistre une tentative et rend vrai, ou rend faux (rien enregistré) si l'IP en a déjà fait `seuil`
 * dans la fenêtre. IP absente : une clé commune. Purge les traces échues du même type.
 */
export async function compterTentative(
  type: string,
  ip: string | null,
  limite: { fenetreMinutes: number; seuil: number },
  maintenant: Date = new Date(),
): Promise<boolean> {
  const cle = empreinte(type, ip ?? 'inconnue')
  const depuis = new Date(maintenant.getTime() - limite.fenetreMinutes * 60_000)
  if ((await prisma.tentativeInscription.count({ where: { cle, createdAt: { gte: depuis } } })) >= limite.seuil) return false
  await prisma.$transaction([
    prisma.tentativeInscription.deleteMany({ where: { cle: { startsWith: `${type}:` }, createdAt: { lt: depuis } } }),
    prisma.tentativeInscription.create({ data: { cle } }),
  ])
  return true
}
