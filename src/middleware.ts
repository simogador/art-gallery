import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const PROTECTED = ['/dashboard', '/wishlist', '/panier']

// Maintenance is on in Vercel production unless MAINTENANCE_MODE=off.
// Previews and local dev show the real site. Admins always bypass it.
function maintenanceEnabled() {
  if (process.env.MAINTENANCE_MODE === 'off') return false
  if (process.env.MAINTENANCE_MODE === 'on')  return true
  return process.env.VERCEL_ENV === 'production'
}

export default auth((req: any) => {
  const session  = req.auth
  const { pathname } = req.nextUrl
  // Passage des admins pendant la maintenance : rôle du jeton (le middleware tourne en edge,
  // sans accès à la base), comme avant la story 1.8.
  const role     = (session?.user as any)?.role ?? null

  if (maintenanceEnabled() && role !== 'admin' && !pathname.startsWith('/auth')) {
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
