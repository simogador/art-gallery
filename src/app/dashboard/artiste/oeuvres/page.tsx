import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils/artworks'
import { ArtworkImage } from '@/components/ui'
import { gradient, accent } from '@/lib/db/mappers'

export const metadata: Metadata = { title: 'Mes œuvres — Errancy' }

export default async function OeuvresPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
    select: { id: true, slug: true, name: true },
  })

  if (!artist) redirect('/dashboard/artiste')

  const artworks = await prisma.artwork.findMany({
    where:   { artistId: artist.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, title: true, year: true,
      medium: true, dimensions: true, price: true,
      available: true, featured: true, imageUrl: true,
      createdAt: true,
    },
  })

  const available = artworks.filter((w) =>  w.available).length
  const sold      = artworks.filter((w) => !w.available).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-4">
        <div>
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Collection</p>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Mes œuvres
          </h1>
          <p className="font-sans text-sm text-neutral-400 mt-2">
            {artworks.length} œuvre{artworks.length !== 1 ? 's' : ''} · {available} disponible{available !== 1 ? 's' : ''} · {sold} vendue{sold !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/artiste/oeuvres/nouvelle"
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-sm font-sans text-xs uppercase tracking-widest hover:bg-neutral-700 transition-colors duration-300"
        >
          <PlusIcon />
          Ajouter
        </Link>
      </div>

      {artworks.length === 0 ? (
        <div className="py-32 border border-dashed border-neutral-200 rounded-sm flex flex-col items-center justify-center text-center">
          <p className="font-serif text-xl font-light text-neutral-400 mb-2">Aucune œuvre</p>
          <p className="font-sans text-sm text-neutral-400 mb-8 max-w-xs">
            Commencez par ajouter votre première œuvre à la collection Errancy.
          </p>
          <Link
            href="/dashboard/artiste/oeuvres/nouvelle"
            className="font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300"
          >
            Ajouter une œuvre
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[56px_1fr_120px_100px_90px_40px] gap-4 items-center px-4 mb-1">
            {['', 'Titre', 'Technique', 'Prix', 'Statut', ''].map((h) => (
              <span key={h} className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{h}</span>
            ))}
          </div>

          {artworks.map((artwork) => (
            <div
              key={artwork.slug}
              className="grid grid-cols-[48px_1fr_auto] md:grid-cols-[56px_1fr_120px_100px_90px_40px] gap-4 items-center p-4 border border-neutral-200 rounded-sm hover:border-neutral-400 transition-colors duration-200 group"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-14 md:w-14 md:h-[3.5rem] rounded-sm overflow-hidden flex-shrink-0">
                <ArtworkImage
                  imageUrl={artwork.imageUrl}
                  title={artwork.title}
                  gradient={gradient(artwork.slug)}
                  accentColor={accent(artwork.slug)}
                  sizes="56px"
                />
              </div>

              {/* Title + year */}
              <div className="min-w-0">
                <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-200 truncate">
                  {artwork.title}
                </p>
                <p className="font-sans text-xs text-neutral-400 mt-0.5 truncate">
                  {artwork.year}{artwork.dimensions ? ` · ${artwork.dimensions}` : ''}
                </p>
              </div>

              {/* Technique */}
              <p className="font-sans text-xs text-neutral-500 truncate hidden md:block">
                {artwork.medium}
              </p>

              {/* Price */}
              <p className="font-serif text-sm font-light text-foreground hidden md:block">
                {artwork.price ? formatPrice(artwork.price) : '—'}
              </p>

              {/* Status */}
              <div className="hidden md:flex">
                <StatusBadge available={artwork.available} />
              </div>

              {/* Edit link */}
              <Link
                href={`/dashboard/artiste/oeuvres/${artwork.slug}`}
                className="flex items-center justify-center w-8 h-8 rounded-sm border border-neutral-200 hover:border-foreground hover:bg-neutral-50 transition-all duration-200 group/edit"
                aria-label={`Modifier ${artwork.title}`}
              >
                <EditIcon />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ available }: { available: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm ${
      available
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
      {available ? 'Disponible' : 'Vendue'}
    </span>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="text-neutral-400 group-hover/edit:text-foreground transition-colors duration-200">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
