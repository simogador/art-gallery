import { NextResponse, type NextRequest } from 'next/server'
import { lireInvitation } from '@/lib/acces'
import { CHEMIN_COOKIE_INVITATION, COOKIE_INVITATION } from '../cookie'

// Ouverture d'un lien d'invitation (AD-14, story 2.4) : le jeton est échangé contre un cookie
// httpOnly, puis l'URL est redirigée sans jeton. Le code ne journalise jamais le jeton ; seule cette
// première requête le porte dans son chemin, que les journaux de requêtes de l'hébergeur peuvent
// conserver (limite d'AD-14, atténuée par l'usage unique et l'échéance).

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { jeton: string } }) {
  const invitation = await lireInvitation(params.jeton)
  const reponse = NextResponse.redirect(new URL('/auth/invitation', req.nextUrl), 303)
  reponse.headers.set('Referrer-Policy', 'no-referrer')
  reponse.headers.set('Cache-Control', 'no-store')
  if (invitation) {
    reponse.cookies.set(COOKIE_INVITATION, params.jeton, {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: CHEMIN_COOKIE_INVITATION,
      expires: invitation.echeance,
    })
  } else {
    reponse.cookies.delete({ name: COOKIE_INVITATION, path: CHEMIN_COOKIE_INVITATION })
  }
  return reponse
}
