import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { LIMITES_INSCRIPTION_OUVERTURE } from '@/lib/reglages'
import { normaliserEmail } from './email'

// Module demandes : contacts laissés sur la page de maintenance (FR-35).
// Aucun e-mail ni adresse IP n'est journalisé ; les limites portent sur des empreintes.

export type RefusInscription = 'email_invalide' | 'consentement_manquant' | 'trop_de_demandes'
export type ResultatInscription = { ok: true } | { ok: false; code: RefusInscription }

export { normaliserEmail } from './email'

function empreinte(type: 'ip' | 'email', valeur: string): string {
  // AUTH_SECRET sert de sel : une empreinte d'IP ne se retrouve pas par simple liste.
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

async function envoisRecents(cle: string, depuis: Date): Promise<number> {
  return prisma.tentativeInscription.count({ where: { cle, createdAt: { gte: depuis } } })
}

export async function inscrireOuverture(entree: {
  email: unknown
  consentement: unknown
  ip: string | null
}): Promise<ResultatInscription> {
  // Limites souples : des envois strictement simultanés peuvent dépasser le seuil d'une
  // ou deux unités, ce qui suffit contre l'abus ordinaire d'un formulaire public.
  const { fenetreMinutes, parIp, parEmail } = LIMITES_INSCRIPTION_OUVERTURE
  const depuis = new Date(Date.now() - fenetreMinutes * 60_000)
  const email = normaliserEmail(entree.email)

  const cles: string[] = []
  {
    // IP absente : une clé commune, pour que la limite par IP ne disparaisse pas.
    const cle = empreinte('ip', entree.ip ?? 'inconnue')
    if ((await envoisRecents(cle, depuis)) >= parIp) return { ok: false, code: 'trop_de_demandes' }
    cles.push(cle)
  }
  if (email) {
    const cle = empreinte('email', email)
    if ((await envoisRecents(cle, depuis)) >= parEmail) return { ok: false, code: 'trop_de_demandes' }
    cles.push(cle)
  }

  // Chaque envoi compte, même invalide ; les traces plus anciennes que la fenêtre sont purgées.
  await prisma.$transaction([
    prisma.tentativeInscription.deleteMany({ where: { createdAt: { lt: depuis } } }),
    prisma.tentativeInscription.createMany({ data: cles.map((cle) => ({ cle })) }),
  ])

  if (!email) return { ok: false, code: 'email_invalide' }
  if (entree.consentement !== true) return { ok: false, code: 'consentement_manquant' }

  // Déjà inscrit : rien ne change (ni doublon, ni nouvelle date de consentement).
  // ON CONFLICT DO NOTHING : deux envois simultanés du même e-mail ne se gênent pas.
  await prisma.inscriptionOuverture.createMany({
    data: [{ email, consentementLe: new Date() }],
    skipDuplicates: true,
  })
  return { ok: true }
}

export async function compterInscriptionsOuverture(): Promise<number> {
  return prisma.inscriptionOuverture.count()
}

export async function listerInscriptionsOuverture(): Promise<{ email: string; consentementLe: Date }[]> {
  return prisma.inscriptionOuverture.findMany({
    orderBy: { consentementLe: 'asc' },
    select: { email: true, consentementLe: true },
  })
}
