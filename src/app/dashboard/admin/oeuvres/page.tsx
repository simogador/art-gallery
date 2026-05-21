import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils/artworks'
import { ArtworkImage } from '@/components/ui'
import { gradient, accent } from '@/lib/db/mappers'
import { ToggleAction } from '@/components/dashboard/ToggleAction'
import { DeleteButton } from '@/components/dashboard/DeleteButton'

export const metadata: Metadata = { title: 'Œuvres — Admin Errancy' }

export default async function AdminOeuvresPage() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') redirect('/dashboard')

  const artworks = await prisma.artwork.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: { artist: { select: { name: true, slug: true } } },
  })

  const available = artworks.filter((w) =>  w.available).length
  const sold      = artworks.filter((w) => !w.available).length

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Gestion</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Œuvres
        </h1>
        <p className="font-sans text-sm text-neutral-400 mt-2">
          {artworks.length} œuvre{artworks.length > 1 ? 's' : ''} · {available} disponibles · {sold} vendues
        </p>
      </div>

      {/* Column headers */}
      <div className="hidden lg:grid grid-cols-[56px_1fr_140px_90px_90px_80px] gap-4 px-4 mb-2">
        {['', 'Titre', 'Artiste', 'Prix', 'Statut', ''].map((h) => (
          <span key={h} className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{h}</span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {artworks.map((artwork) => (
          <div key={artwork.slug}
            className="grid grid-cols-[48px_1fr_auto] lg:grid-cols-[56px_1fr_140px_90px_90px_80px] gap-4 items-center p-4 border border-neutral-200 rounded-sm hover:border-neutral-300 transition-colors duration-200 group">

            {/* Thumbnail */}
            <div className="relative w-12 h-14 rounded-sm overflow-hidden flex-shrink-0">
              <ArtworkImage
                imageUrl={artwork.imageUrl}
                title={artwork.title}
                gradient={gradient(artwork.slug)}
                accentColor={accent(artwork.slug)}
                sizes="48px"
              />
            </div>

            {/* Title */}
            <div className="min-w-0">
              <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-200 truncate">
                {artwork.title}
              </p>
              <p className="font-sans text-xs text-neutral-400 mt-0.5">{artwork.year} · {artwork.medium}</p>
            </div>

            {/* Artist */}
            <Link href={`/artistes/${artwork.artist.slug}`} target="_blank"
              className="font-sans text-xs text-neutral-500 hover:text-foreground truncate hidden lg:block">
              {artwork.artist.name}
            </Link>

            {/* Price */}
            <p className="font-serif text-sm font-light text-foreground hidden lg:block">
              {artwork.price ? formatPrice(artwork.price) : '—'}
            </p>

            {/* Status toggle */}
            <div className="hidden lg:block">
              <ToggleAction
                value={artwork.available}
                apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
                field="available"
                labelOn="Dispo"
                labelOff="Vendue"
                colorOn="green"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/admin/oeuvres/${artwork.slug}`}
                className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
              >
                Éditer
              </Link>
              <DeleteButton
                apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
                label="Suppr."
                confirm={`Supprimer "${artwork.title}" ? Cette action est irréversible.`}
                redirectTo="/dashboard/admin/oeuvres"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
