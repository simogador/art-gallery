import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils/artworks'
import { RoleSelect } from '@/components/dashboard/RoleSelect'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const user    = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } })
  return { title: `${user?.name ?? user?.email ?? id} — Admin` }
}

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') redirect('/dashboard')

  const { id } = await params
  const user   = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, image: true, createdAt: true,
      artist: { select: { name: true, slug: true, nationality: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, stripeSessionId: true, artworkIds: true,
          amount: true, currency: true, status: true,
          customerEmail: true, createdAt: true,
        },
      },
    },
  })
  if (!user) notFound()

  const totalSpent = user.orders.reduce((s, o) => s + o.amount, 0)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard/admin/utilisateurs"
          className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200">
          Utilisateurs
        </Link>
        <span className="text-neutral-300">›</span>
        <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
          {user.name ?? user.email}
        </span>
      </div>

      {/* Profile card */}
      <div className="border border-neutral-200 rounded-sm mb-8">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {user.image
                ? <img src={user.image} alt="" className="w-full h-full object-cover" />
                : <span className="font-serif text-lg font-light text-neutral-500">
                    {(user.name ?? user.email ?? 'U')[0].toUpperCase()}
                  </span>
              }
            </div>
            <div>
              <p className="font-serif text-xl font-light text-foreground">{user.name ?? '—'}</p>
              <p className="font-sans text-sm text-neutral-400">{user.email}</p>
            </div>
          </div>
          <RoleSelect userId={user.id} currentRole={user.role as any} />
        </div>

        {[
          { label: 'Inscrit le',  value: new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Commandes',   value: `${user.orders.length}` },
          { label: 'Total dépensé', value: totalSpent > 0 ? formatPrice(totalSpent) : '—' },
          ...(user.artist ? [{ label: 'Profil artiste', value: user.artist.name }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-100 last:border-0">
            <span className="font-sans text-xs uppercase tracking-widest text-neutral-400">{label}</span>
            <span className="font-sans text-sm text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div>
        <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-500 mb-5">
          Commandes ({user.orders.length})
        </h2>

        {user.orders.length === 0 ? (
          <div className="py-12 border border-dashed border-neutral-200 rounded-sm text-center">
            <p className="font-serif text-lg font-light text-neutral-400">Aucune commande</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {user.orders.map((order) => {
              const slugs = order.artworkIds.split(',').filter(Boolean)
              return (
                <div key={order.id}
                  className="border border-neutral-200 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
                    <div>
                      <p className="font-sans text-xs text-foreground font-medium">
                        #{order.stripeSessionId.slice(-8).toUpperCase()}
                      </p>
                      <p className="font-sans text-[10px] text-neutral-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {order.status}
                      </span>
                      <p className="font-serif text-base font-light text-foreground">{formatPrice(order.amount)}</p>
                    </div>
                  </div>

                  <div className="px-5 py-3">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Œuvres</p>
                    <div className="flex flex-wrap gap-2">
                      {slugs.map((slug) => (
                        <Link key={slug} href={`/galerie/${slug}`} target="_blank"
                          className="font-sans text-xs text-neutral-600 border border-neutral-200 rounded-sm px-2 py-1 hover:border-foreground hover:text-foreground transition-colors duration-200">
                          {slug}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
