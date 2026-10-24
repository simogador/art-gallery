import type { NextAuthConfig } from 'next-auth'

// Edge-safe config shared with middleware.ts — no Prisma / bcrypt imports here.
// The jwt/session callbacks live here so the middleware sees the user's role.
export const authConfig = {
  pages: {
    signIn: '/auth/connexion',
    error:  '/auth/connexion',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = (user as any).role ?? 'user'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id        = token.id as string
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
