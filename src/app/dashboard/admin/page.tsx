import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { fr } from '@/lib/i18n'
import { acteurCourant } from '@/lib/acces'
import { compterInscriptionsOuverture } from '@/lib/demandes'
import { compterOeuvres } from '@/lib/disponibilite'

export const metadata: Metadata = { title: 'Admin — Errancy' }

export default async function AdminPage() {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const [
    oeuvres,
    artistsTotal,
    usersTotal,
    inscritsOuverture,
  ] = await Promise.all([
    // Story 2.2 : comptages par le module disponibilite.
    compterOeuvres(),
    prisma.artist.count(),
    prisma.user.count(),
    compterInscriptionsOuverture(),
  ])

  const stats = [
    { label: 'Œuvres',        value: oeuvres.total,         sub: `${oeuvres.disponibles} dispo · ${oeuvres.vendues} vendues · ${oeuvres.nonPubliees} non publiées` },
    { label: 'Artistes',      value: artistsTotal,          sub: 'profils actifs' },
    { label: 'Utilisateurs',  value: usersTotal,            sub: 'comptes inscrits' },
  ]

  const quickLinks = [
    { href: '/dashboard/admin/artistes',     label: 'Gérer les artistes',    desc: 'Activer, désactiver, lier un compte' },
    { href: '/dashboard/admin/oeuvres',      label: 'Gérer les œuvres',      desc: 'Statut, modification, suppression' },
    { href: '/dashboard/admin/utilisateurs', label: 'Gérer les utilisateurs', desc: 'Rôles, comptes' },
  ]

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-600 mb-3">Administration</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Vue d&apos;ensemble
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="border border-neutral-200 rounded-sm p-5">
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 mb-2">{label}</p>
            <p className="font-serif text-3xl font-light text-foreground">{value}</p>
            <p className="font-sans text-[10px] text-neutral-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {quickLinks.map(({ href, label, desc }) => (
          <Link key={href} href={href}
            className="group flex flex-col gap-2 p-5 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300">
            <p className="font-serif text-base font-light text-foreground group-hover:text-neutral-600 transition-colors duration-300">{label}</p>
            <p className="font-sans text-xs text-neutral-600">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Contacts de la page de maintenance (FR-35) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 mb-12 border border-neutral-200 rounded-sm">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
            Inscrits à l&apos;ouverture
          </p>
          <p className="font-serif text-3xl font-light text-foreground">{inscritsOuverture}</p>
          <p className="font-sans text-[10px] text-neutral-600 mt-1">laissés sur la page de maintenance</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/admin/ouverture"
            className="inline-flex min-h-touch-target items-center font-sans text-xs uppercase tracking-widest px-4 py-2 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
          >
            {fr.ouverture.titre}
          </Link>
          {inscritsOuverture > 0 && (
            <a
              href="/api/admin/inscriptions-ouverture"
              className="font-sans text-xs uppercase tracking-widest px-4 py-2 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
            >
              Exporter la liste (CSV)
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
