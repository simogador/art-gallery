import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { DashboardNav } from '@/components/dashboard/DashboardNav'

export default async function ArtisteDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const role = (session.user as any).role
  if (role !== 'artist') redirect('/dashboard')

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
    select: { id: true, slug: true, name: true, imageUrl: true },
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="fixed top-0 inset-x-0 z-40 h-16 bg-background border-b border-neutral-200 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-serif text-lg font-light text-foreground tracking-wider hover:text-gold transition-colors duration-300"
            >
              Errancy
            </Link>
            <span className="text-neutral-300 select-none">·</span>
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-500">
              Espace artiste
            </span>
          </div>

          <div className="flex items-center gap-4">
            {artist && (
              <span className="font-sans text-xs text-neutral-500 hidden sm:block">
                {artist.name}
              </span>
            )}
            <Link
              href="/dashboard"
              className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-300"
            >
              Mon compte
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16 flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 py-10 pr-8 hidden md:block">
          <DashboardNav artistSlug={artist?.slug ?? null} />
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-neutral-200">
          <DashboardNav artistSlug={artist?.slug ?? null} mobile />
        </div>

        {/* Main */}
        <main className="flex-1 py-10 pb-24 md:pb-10 min-w-0">
          {!artist && (
            <div className="mb-8 px-4 py-3 border border-amber-200 bg-amber-50/50 rounded-sm">
              <p className="font-sans text-xs text-amber-700">
                Aucun profil artiste n&apos;est lié à ce compte. Contactez l&apos;administrateur pour activer votre espace.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
