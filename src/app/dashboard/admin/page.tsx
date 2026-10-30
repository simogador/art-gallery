import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils/artworks'
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
    ordersAgg,
    recentOrders,
    inscritsOuverture,
  ] = await Promise.all([
    // Story 2.2 : comptages par le module disponibilite.
    compterOeuvres(),
    prisma.artist.count(),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { amount: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, stripeSessionId: true, artworkIds: true,
        amount: true, customerEmail: true, status: true, createdAt: true,
      },
    }),
    compterInscriptionsOuverture(),
  ])

  const revenue = ordersAgg._sum.amount ?? 0

  const stats = [
    { label: 'Œuvres',        value: oeuvres.total,         sub: `${oeuvres.disponibles} dispo · ${oeuvres.vendues} vendues · ${oeuvres.nonPubliees} non publiées` },
    { label: 'Artistes',      value: artistsTotal,          sub: 'profils actifs' },
    { label: 'Utilisateurs',  value: usersTotal,            sub: 'comptes inscrits' },
    { label: "Chiffre d'aff.", value: formatPrice(revenue), sub: `${recentOrders.length} commande${recentOrders.length > 1 ? 's' : ''}` },
  ]

  const quickLinks = [
    { href: '/dashboard/admin/artistes',     label: 'Gérer les artistes',    desc: 'Activer, désactiver, lier un compte' },
    { href: '/dashboard/admin/oeuvres',      label: 'Gérer les œuvres',      desc: 'Statut, modification, suppression' },
    { href: '/dashboard/admin/utilisateurs', label: 'Gérer les utilisateurs', desc: 'Rôles, commandes, historique' },
  ]

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Administration</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Vue d&apos;ensemble
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="border border-neutral-200 rounded-sm p-5">
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-2">{label}</p>
            <p className="font-serif text-3xl font-light text-foreground">{value}</p>
            <p className="font-sans text-[10px] text-neutral-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {quickLinks.map(({ href, label, desc }) => (
          <Link key={href} href={href}
            className="group flex flex-col gap-2 p-5 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300">
            <p className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-300">{label}</p>
            <p className="font-sans text-xs text-neutral-400">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Contacts de la page de maintenance (FR-35) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 mb-12 border border-neutral-200 rounded-sm">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            Inscrits à l&apos;ouverture
          </p>
          <p className="font-serif text-3xl font-light text-foreground">{inscritsOuverture}</p>
          <p className="font-sans text-[10px] text-neutral-400 mt-1">laissés sur la page de maintenance</p>
        </div>
        {inscritsOuverture > 0 && (
          <a
            href="/api/admin/inscriptions-ouverture"
            className="font-sans text-xs uppercase tracking-widest px-4 py-2 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
          >
            Exporter la liste (CSV)
          </a>
        )}
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-500 mb-5">
            Commandes récentes
          </h2>
          <div className="flex flex-col gap-2">
            {recentOrders.map((order) => (
              <div key={order.id}
                className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-4 border border-neutral-200 rounded-sm">
                <div className="min-w-0">
                  <p className="font-sans text-xs text-foreground truncate">
                    {order.customerEmail ?? '—'}
                  </p>
                  <p className="font-sans text-[10px] text-neutral-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}#{order.stripeSessionId.slice(-6).toUpperCase()}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {order.status}
                </span>
                <p className="font-serif text-sm font-light text-foreground">{formatPrice(order.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
