import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ArtworkForm } from '@/components/dashboard/ArtworkForm'
import { ToggleAction } from '@/components/dashboard/ToggleAction'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: `Éditer ${slug} — Admin` }
}

export default async function AdminEditOeuvrePage({ params }: Props) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') redirect('/dashboard')

  const { slug } = await params
  const artwork  = await prisma.artwork.findUnique({
    where:  { slug },
    include: { artist: { select: { name: true, slug: true } } },
  })
  if (!artwork) notFound()

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/dashboard/admin/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200">
            Œuvres
          </Link>
          <span className="text-neutral-300">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
            {artwork.title}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
              {artwork.title}
            </h1>
            <p className="font-sans text-sm text-neutral-400 mt-1">
              {artwork.artist.name} · {artwork.year}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ToggleAction
              value={artwork.available}
              apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
              field="available"
              labelOn="Disponible"
              labelOff="Vendue"
              colorOn="green"
            />
            <Link href={`/galerie/${artwork.slug}`} target="_blank"
              className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200">
              Voir ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="divider mb-10" />

      <ArtworkForm
        mode="edit"
        apiBase="/api/admin/oeuvres"
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
