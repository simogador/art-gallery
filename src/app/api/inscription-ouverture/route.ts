import { NextRequest, NextResponse } from 'next/server'
import { inscrireOuverture, type RefusInscription } from '@/lib/demandes'

// Formulaire « Me notifier » de public/maintenance.html (FR-35). Route handler : la page est
// statique, sans action serveur possible. Hors du middleware, donc joignable pendant la maintenance.

const MESSAGES: Record<RefusInscription, { message: string; statut: number }> = {
  email_invalide: { message: 'Cette adresse e-mail ne semble pas valide.', statut: 400 },
  consentement_manquant: {
    message: 'Cochez la case pour accepter que nous gardions votre e-mail jusqu’à l’ouverture.',
    statut: 400,
  },
  trop_de_demandes: { message: 'Trop d’envois pour le moment : réessayez un peu plus tard.', statut: 429 },
}

function adresseIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

const REQUETE_INVALIDE = { ok: false, code: 'requete_invalide', message: 'Envoi invalide, rechargez la page et réessayez.' }

// Seule la page du site peut envoyer ce formulaire (pas un autre site, à l'insu du visiteur).
function origineAutorisee(req: NextRequest): boolean {
  const origine = req.headers.get('origin')
  if (!origine) return true
  try {
    return new URL(origine).host === req.headers.get('host')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!origineAutorisee(req)) return NextResponse.json(REQUETE_INVALIDE, { status: 403 })

  let corps: unknown
  try {
    corps = await req.json()
  } catch {
    corps = null
  }
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return NextResponse.json(REQUETE_INVALIDE, { status: 400 })
  }

  try {
    const { email, consentement } = corps as { email?: unknown; consentement?: unknown }
    const resultat = await inscrireOuverture({ email, consentement, ip: adresseIp(req) })
    if (resultat.ok) {
      return NextResponse.json({ ok: true, message: 'Merci ! Nous vous écrirons à l’ouverture.' })
    }
    const { message, statut } = MESSAGES[resultat.code]
    return NextResponse.json({ ok: false, code: resultat.code, message }, { status: statut })
  } catch (erreur) {
    // Jamais l'e-mail dans les journaux : seulement le type d'erreur.
    console.error('[inscription-ouverture] échec', erreur instanceof Error ? erreur.name : 'inconnu')
    return NextResponse.json(
      { ok: false, code: 'indisponible', message: 'Inscription momentanément indisponible, réessayez plus tard.' },
      { status: 503 },
    )
  }
}
