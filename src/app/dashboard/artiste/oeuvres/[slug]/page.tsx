import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ArtworkForm } from '@/components/dashboard/ArtworkForm'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: `Modifier ${slug} — Errancy` }
}

export default async function EditOeuvrePage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const { slug } = await params

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!artist) redirect('/dashboard/artiste')

  const artwork = await prisma.artwork.findUnique({
    where:  { slug },
    select: {
      id: true, slug: true, title: true, year: true,
      medium: true, dimensions: true, price: true,
      description: true, imageUrl: true, available: true,
      artistId: true,
    },
  })

  if (!artwork || artwork.artistId !== artist.id) notFound()

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
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
            {artwork.title}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
              {artwork.title}
            </h1>
            <p className="font-sans text-sm text-neutral-400 mt-2">
              {artwork.year}{artwork.dimensions ? ` · ${artwork.dimensions}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm ${
              artwork.available
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${artwork.available ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
              {artwork.available ? 'Disponible' : 'Vendue'}
            </span>
            <Link
              href={`/galerie/${artwork.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
            >
              Voir ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="divider mb-10" />

      <ArtworkForm
        mode="edit"
        artwork={{
          slug:        artwork.slug,
          title:       artwork.title,
          year:        artwork.year,
          medium:      artwork.medium,
          dimensions:  artwork.dimensions ?? '',
          price:       artwork.price,
          description: artwork.description,
          imageUrl:    artwork.imageUrl ?? null,
          available:   artwork.available,
        }}
      />
    </div>
  )
}
