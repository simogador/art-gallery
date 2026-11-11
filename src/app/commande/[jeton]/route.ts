import { NextResponse, type NextRequest } from 'next/server'
import { lireLienVenteAssistee } from '@/lib/commandes'
import { CHEMIN_COOKIE_COMMANDE, COOKIE_COMMANDE } from '../cookie'

// Ouverture du lien de la commande d'une vente assistée (AD-14, story 6.3) : le jeton est échangé
// contre un cookie httpOnly, puis l'URL est redirigée sans jeton. Le jeton n'est pas consommé (le
// lien de l'e-mail se rouvre jusqu'à l'échéance de la réservation). Jamais journalisé ; seule cette
// première requête le porte dans son chemin (limite d'AD-14). Hors mesure.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { jeton: string } }) {
  const reponse = NextResponse.redirect(new URL('/commande', req.nextUrl), 303)
  reponse.headers.set('Referrer-Policy', 'no-referrer')
  reponse.headers.set('Cache-Control', 'no-store')
  let lien: Awaited<ReturnType<typeof lireLienVenteAssistee>>
  try {
    lien = await lireLienVenteAssistee(params.jeton)
  } catch {
    // Panne de la base : on ne sait rien du lien, aucun cookie n'est touché.
    return reponse
  }
  if (lien) {
    reponse.cookies.set(COOKIE_COMMANDE, params.jeton, {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: CHEMIN_COOKIE_COMMANDE,
      expires: lien.echeance,
    })
  } else if (req.cookies.get(COOKIE_COMMANDE)?.value === params.jeton) {
    // Le cookie d'une commande encore valable (autre lien) n'est effacé que s'il porte ce jeton-là.
    reponse.cookies.delete({ name: COOKIE_COMMANDE, path: CHEMIN_COOKIE_COMMANDE })
  }
  return reponse
}
