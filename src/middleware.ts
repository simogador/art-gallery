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

  if (pathname.startsWith('/dashboard/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
  }

  if (pathname.startsWith('/dashboard/artiste')) {
    if (role !== 'artist' && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  // Every page, but not API routes (Stripe webhook, auth), Next internals or static files
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
