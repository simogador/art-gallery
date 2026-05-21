import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils/artworks'
import { ArtworkImage } from '@/components/ui'
import { gradient, accent } from '@/lib/db/mappers'

export const metadata: Metadata = { title: 'Espace artiste — Errancy' }

export default async function ArtisteDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
    include: {
      artworks: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, slug: true, title: true, year: true, price: true,
          available: true, imageUrl: true, medium: true,
        },
      },
      _count: { select: { artworks: true } },
    },
  })

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-serif text-2xl font-light text-neutral-400">Profil non configuré</p>
        <p className="font-sans text-sm text-neutral-400 mt-3 max-w-sm text-pretty">
          Votre compte n&apos;est pas encore lié à un profil artiste. Contactez l&apos;équipe Errancy.
        </p>
      </div>
    )
  }

  const totalArtworks = artist._count.artworks
  const soldCount     = artist.artworks.filter((w) => !w.available).length
  const availCount    = artist.artworks.filter((w) =>  w.available).length

  // Revenue: sum of prices for all sold artworks
  const soldArtworks = await prisma.artwork.findMany({
    where: { artistId: artist.id, available: false },
    select: { price: true },
  })
  const revenue = soldArtworks.reduce((sum, w) => sum + (w.price ?? 0), 0)

  const stats = [
    { label: 'Œuvres total',      value: totalArtworks,      unit: '' },
    { label: 'Disponibles',        value: availCount,         unit: '' },
    { label: 'Vendues',            value: soldCount,          unit: '' },
    { label: "Chiffre d'affaires",  value: formatPrice(revenue), unit: '' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">
          Vue d&apos;ensemble
        </p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Bonjour, {artist.name.split(' ')[0]}
        </h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map(({ label, value, unit }) => (
          <div key={label} className="border border-neutral-200 rounded-sm p-5">
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-2">{label}</p>
            <p className="font-serif text-3xl font-light text-foreground">
              {value}{unit}
            </p>
          </div>
        ))}
      </div>

      {/* Recent artworks */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-500">
            Œuvres récentes
          </h2>
          <Link
            href="/dashboard/artiste/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-gold hover:text-gold-dark transition-colors duration-200"
          >
            Tout voir
          </Link>
        </div>

        {artist.artworks.length === 0 ? (
          <div className="py-16 border border-dashed border-neutral-200 rounded-sm text-center">
            <p className="font-serif text-xl font-light text-neutral-400 mb-4">Aucune œuvre</p>
            <Link
              href="/dashboard/artiste/oeuvres/nouvelle"
              className="font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300 inline-block"
            >
              Ajouter votre première œuvre
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {artist.artworks.map((artwork) => (
              <Link
                key={artwork.slug}
                href={`/dashboard/artiste/oeuvres/${artwork.slug}`}
                className="flex items-center gap-4 p-4 border border-neutral-200 rounded-sm hover:border-neutral-400 transition-colors duration-200 group"
              >
                <div className="relative w-12 h-14 flex-shrink-0 rounded-sm overflow-hidden">
                  <ArtworkImage
                    imageUrl={artwork.imageUrl}
                    title={artwork.title}
                    gradient={gradient(artwork.slug)}
                    accentColor={accent(artwork.slug)}
                    sizes="48px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-200 truncate">
                    {artwork.title}
                  </p>
                  <p className="font-sans text-xs text-neutral-400 mt-0.5 truncate">
                    {artwork.year} · {artwork.medium}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm ${
                    artwork.available
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${artwork.available ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {artwork.available ? 'Disponible' : 'Vendue'}
                  </span>
                  {artwork.price && (
                    <p className="font-serif text-sm font-light text-foreground hidden sm:block">
                      {formatPrice(artwork.price)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/artiste/oeuvres/nouvelle"
          className="group flex items-center gap-4 p-5 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
        >
          <div className="w-10 h-10 rounded-sm border border-neutral-200 group-hover:border-gold group-hover:bg-gold/5 flex items-center justify-center transition-all duration-300">
            <PlusIcon />
          </div>
          <div>
            <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-300">
              Ajouter une œuvre
            </p>
            <p className="font-sans text-xs text-neutral-400 mt-0.5">
              Titre, technique, prix, image
            </p>
          </div>
        </Link>

        <Link
          href={`/artistes/${artist.slug}`}
          className="group flex items-center gap-4 p-5 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
        >
          <div className="w-10 h-10 rounded-sm border border-neutral-200 group-hover:border-gold group-hover:bg-gold/5 flex items-center justify-center transition-all duration-300">
            <ExternalIcon />
          </div>
          <div>
            <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-300">
              Voir mon profil public
            </p>
            <p className="font-sans text-xs text-neutral-400 mt-0.5">
              Page visible par les collectionneurs
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="text-neutral-400">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="text-neutral-400">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
