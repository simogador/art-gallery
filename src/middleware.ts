import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'
import { maintenanceActive, passeLaMaintenance } from '@/lib/reglages'

const { auth } = NextAuth(authConfig)

const PROTECTED = ['/dashboard', '/wishlist', '/panier']

export default auth((req: any) => {
  const session  = req.auth
  const { pathname } = req.nextUrl
  // Passage pendant la maintenance (admins partout, artistes dans leur espace) : rôle du jeton (le
  // middleware tourne en edge, sans accès à la base), comme avant la story 1.8.
  const role     = (session?.user as any)?.role ?? null

  if (maintenanceActive() && !passeLaMaintenance(role, pathname)) {
    return NextResponse.rewrite(new URL('/maintenance.html', req.nextUrl))
  }

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  if (!session?.user) {
    const loginUrl = new URL('/auth/connexion', req.nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // AD-15 : le middleware ne vérifie que la session. Les accès par rôle sont décidés par les
  // layouts et les routes, à partir du rôle relu en base (src/lib/acces) : le rôle du jeton
  // peut être périmé après un changement fait par un admin.
  return NextResponse.next()
})

export const config = {
  // Every page, but not API routes (Stripe webhook, auth), Next internals or static files
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
