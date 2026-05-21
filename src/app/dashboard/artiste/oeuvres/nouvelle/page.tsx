import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ArtworkForm } from '@/components/dashboard/ArtworkForm'

export const metadata: Metadata = { title: 'Nouvelle œuvre — Errancy' }

export default async function NouvelleOeuvrePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!artist) redirect('/dashboard/artiste')

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/artiste/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
          >
            Mes œuvres
          </Link>
          <span className="text-neutral-300">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600">Nouvelle</span>
        </div>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Ajouter une œuvre
        </h1>
        <p className="font-sans text-sm text-neutral-400 mt-2">
          L&apos;œuvre sera immédiatement visible sur la galerie Errancy.
        </p>
      </div>

      <div className="divider mb-10" />

      <ArtworkForm mode="create" />
    </div>
  )
}
