import { auth } from '@/auth'
import { redirect } from 'next/navigation'
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
    select: { id: true, slug: true, name: true },
  })

  return (
    // pt-16 mobile (header h-16), pt-20 desktop (header h-20)
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-5rem)]">

        {/* Sidebar desktop */}
        <aside className="w-56 flex-shrink-0 py-10 pr-8 hidden md:flex md:flex-col border-r border-neutral-100">
          <div className="mb-8">
            <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold mb-1">
              Espace artiste
            </p>
            {artist && (
              <p className="font-sans text-xs text-neutral-500 truncate">{artist.name}</p>
            )}
          </div>
          <DashboardNav artistSlug={artist?.slug ?? null} />
        </aside>

        {/* Main content */}
        <main className="flex-1 py-10 pb-24 md:pb-12 min-w-0 md:pl-10">
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

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-neutral-200">
        <DashboardNav artistSlug={artist?.slug ?? null} mobile />
      </div>
    </div>
  )
}
