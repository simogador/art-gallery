import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ToggleAction } from '@/components/dashboard/ToggleAction'
import { DeleteButton } from '@/components/dashboard/DeleteButton'
import { acteurCourant, invitationsEnAttente } from '@/lib/acces'
import { InvitationArtiste } from './InvitationArtiste'
import { AccordArtiste } from './AccordArtiste'
import { FicheArtiste } from './FicheArtiste'

export const metadata: Metadata = { title: 'Artistes — Admin Errancy' }

export default async function AdminArtistesPage() {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const artists = await prisma.artist.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      _count:  { select: { artworks: true } },
      user:    { select: { id: true, email: true, role: true } },
    },
  })
  // Story 2.4 : invitations encore valables des artistes sans compte.
  const enAttente = await invitationsEnAttente(artists.filter((a) => !a.user).map((a) => a.id))

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-600 mb-3">Gestion</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Artistes
        </h1>
        <p className="font-sans text-sm text-neutral-600 mt-2">{artists.length} artiste{artists.length > 1 ? 's' : ''}</p>
      </div>

      {/* Header */}
      <div className="hidden lg:grid grid-cols-[1fr_80px_80px_160px_80px_24px] gap-4 px-4 mb-2">
        {['Artiste', 'Œuvres', 'Actif', 'Compte lié', 'Featured', ''].map((h) => (
          <span key={h} className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{h}</span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {artists.map((artist) => (
          <div key={artist.id}
            className="flex flex-col gap-3 p-4 border border-neutral-200 rounded-sm hover:border-neutral-300 transition-colors duration-200">
          <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_80px_80px_160px_80px_24px] gap-4 items-center">

            {/* Name */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-serif text-base font-light text-foreground truncate">{artist.name}</p>
                {!artist.active && (
                  <span className="font-sans text-[9px] uppercase tracking-widest text-neutral-600 border border-neutral-200 px-1.5 py-0.5 rounded-sm">
                    désactivé
                  </span>
                )}
              </div>
              <p className="font-sans text-xs text-neutral-600 mt-0.5">{artist.nationality} · {artist.slug}</p>
            </div>

            {/* Artworks count */}
            <p className="font-sans text-sm text-neutral-500 hidden lg:block">{artist._count.artworks}</p>

            {/* Active toggle */}
            <div className="hidden lg:block">
              <ToggleAction
                value={artist.active}
                apiUrl={`/api/admin/artistes/${artist.id}`}
                field="active"
                labelOn="Actif"
                labelOff="Inactif"
                colorOn="green"
              />
            </div>

            {/* Linked user */}
            <div className="hidden lg:block min-w-0">
              {artist.user ? (
                <div>
                  <p className="font-sans text-xs text-neutral-600 truncate">{artist.user.email}</p>
                  <span className={`font-sans text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${
                    artist.user.role === 'admin'  ? 'bg-amber-50 text-amber-700 border-amber-200'  :
                    artist.user.role === 'artist' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                    'bg-neutral-100 text-neutral-500 border-neutral-200'
                  }`}>{artist.user.role}</span>
                </div>
              ) : (
                <p className="font-sans text-xs text-neutral-600">Non lié</p>
              )}
            </div>

            {/* Featured toggle */}
            <div className="hidden lg:block">
              <ToggleAction
                value={artist.featured}
                apiUrl={`/api/admin/artistes/${artist.id}`}
                field="featured"
                labelOn="Featured"
                labelOff="Non feat."
                colorOn="gold"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                href={`/artistes/${artist.slug}`}
                className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 hover:text-foreground transition-colors duration-200"
                target="_blank"
              >
                ↗
              </Link>
            </div>
          </div>
          {/* Story 2.7 (FR-16) : accord écrit signé, enregistré par le module curation. */}
          <AccordArtiste
            artistId={artist.id}
            nom={artist.name}
            accordSigneLe={artist.accordSigneLe ? artist.accordSigneLe.toISOString() : null}
          />
          {/* Story 3.11 (FR-19) : page publique gérée par l'équipe. */}
          <FicheArtiste
            artistId={artist.id}
            nom={artist.name}
            fiche={{
              bio: artist.bio,
              statement: artist.statement,
              formation: artist.formation,
              expositions: artist.expositions,
              imageUrl: artist.imageUrl || null,
              atelierUrl: artist.atelierUrl,
            }}
          />
          {!artist.user && (
            <InvitationArtiste
              artistId={artist.id}
              nom={artist.name}
              enAttente={
                enAttente[artist.id]
                  ? {
                      email: enAttente[artist.id].email,
                      statut: enAttente[artist.id].statut,
                      echeance: enAttente[artist.id].echeance?.toISOString() ?? null,
                    }
                  : null
              }
            />
          )}
          </div>
        ))}
      </div>
    </div>
  )
}
