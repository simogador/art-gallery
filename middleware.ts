import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req: any) => {
  const session  = req.auth
  const { pathname } = req.nextUrl
  const role     = (session?.user as any)?.role ?? null

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
  matcher: ['/dashboard/:path*', '/wishlist/:path*', '/panier/:path*'],
}
