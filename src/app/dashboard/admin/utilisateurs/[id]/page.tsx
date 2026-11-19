import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formaterDate } from '@/lib/i18n'
import { RoleSelect } from '@/components/dashboard/RoleSelect'
import { acteurCourant } from '@/lib/acces'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const user    = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } })
  return { title: `${user?.name ?? user?.email ?? id} — Admin` }
}

export default async function AdminUserDetailPage({ params }: Props) {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const { id } = await params
  const user   = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, image: true, createdAt: true,
      artist: { select: { name: true, slug: true, nationality: true } },
    },
  })
  if (!user) notFound()

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard/admin/utilisateurs"
          className="font-sans text-xs uppercase tracking-widest text-neutral-600 hover:text-foreground transition-colors duration-200">
          Utilisateurs
        </Link>
        <span className="text-neutral-600">›</span>
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
              <p className="font-sans text-sm text-neutral-600">{user.email}</p>
            </div>
          </div>
          <RoleSelect userId={user.id} currentRole={user.role as any} />
        </div>

        {[
          { label: 'Inscrit le',  value: formaterDate(user.createdAt) },
          ...(user.artist ? [{ label: 'Profil artiste', value: user.artist.name }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-100 last:border-0">
            <span className="font-sans text-xs uppercase tracking-widest text-neutral-600">{label}</span>
            <span className="font-sans text-sm text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
