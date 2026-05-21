import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { RoleSelect } from '@/components/dashboard/RoleSelect'
import { formatPrice } from '@/lib/utils/artworks'

export const metadata: Metadata = { title: 'Utilisateurs — Admin Errancy' }

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, role: true, image: true,
      createdAt: true,
      orders:  { select: { amount: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      artist:  { select: { name: true, slug: true } },
    },
  })

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Gestion</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Utilisateurs
        </h1>
        <p className="font-sans text-sm text-neutral-400 mt-2">{users.length} compte{users.length > 1 ? 's' : ''}</p>
      </div>

      {/* Column headers */}
      <div className="hidden lg:grid grid-cols-[1fr_100px_90px_80px_24px] gap-4 px-4 mb-2">
        {['Utilisateur', 'Rôle', 'Commandes', 'Total dépensé', ''].map((h) => (
          <span key={h} className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{h}</span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {users.map((user) => {
          const totalSpent  = user.orders.reduce((s, o) => s + o.amount, 0)
          const orderCount  = user.orders.length

          return (
            <div key={user.id}
              className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_100px_90px_80px_24px] gap-4 items-center p-4 border border-neutral-200 rounded-sm hover:border-neutral-300 transition-colors duration-200">

              {/* User info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.image
                    ? <img src={user.image} alt="" className="w-full h-full object-cover" />
                    : <span className="font-sans text-xs text-neutral-500">
                        {(user.name ?? user.email ?? 'U')[0].toUpperCase()}
                      </span>
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-sm text-foreground truncate">{user.name ?? '—'}</p>
                  <p className="font-sans text-xs text-neutral-400 truncate">{user.email}</p>
                  {user.artist && (
                    <p className="font-sans text-[10px] text-violet-600 mt-0.5">
                      ↳ {user.artist.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Role */}
              <div>
                <RoleSelect userId={user.id} currentRole={user.role as any} />
              </div>

              {/* Orders */}
              <p className="font-sans text-sm text-neutral-500 hidden lg:block">
                {orderCount} {orderCount !== 1 ? 'commandes' : 'commande'}
              </p>

              {/* Total spent */}
              <p className="font-serif text-sm font-light text-foreground hidden lg:block">
                {totalSpent > 0 ? formatPrice(totalSpent) : '—'}
              </p>

              {/* Detail link */}
              <Link
                href={`/dashboard/admin/utilisateurs/${user.id}`}
                className="font-sans text-[10px] text-neutral-400 hover:text-foreground transition-colors duration-200"
              >
                ›
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
