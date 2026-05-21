import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Mon espace' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  const role = (session.user as any).role
  const { name, email, image } = session.user
  const initials = (name ?? email ?? 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-background pt-28 pb-24">
      <div className="container-premium max-w-4xl">

        {/* Header */}
        <div className="mb-12">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">Mon espace</span>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-sm bg-foreground flex items-center justify-center flex-shrink-0">
              {image
                ? <img src={image} alt={name ?? ''} className="w-full h-full object-cover rounded-sm" />
                : <span className="font-serif text-xl font-light text-background">{initials}</span>
              }
            </div>
            <div>
              <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
                {name ?? 'Collectionneur'}
              </h1>
              <p className="font-sans text-sm text-neutral-400 mt-1">{email}</p>
            </div>
          </div>
          <div className="divider mt-6" />
        </div>

        {/* Nav cards */}
        {role === 'admin' && (
          <div className="mb-4">
            <Link
              href="/dashboard/admin"
              className="group flex items-center justify-between p-5 border border-red-200/60 bg-red-50/40 rounded-sm hover:border-red-300 transition-colors duration-300"
            >
              <div className="flex items-center gap-4">
                <span className="text-red-500"><ShieldIcon /></span>
                <div>
                  <p className="font-serif text-lg font-light text-foreground group-hover:text-red-600 transition-colors duration-300">
                    Administration
                  </p>
                  <p className="font-sans text-xs text-neutral-400 mt-0.5">Gérer artistes, œuvres et utilisateurs</p>
                </div>
              </div>
              <span className="font-sans text-xs text-red-500">Accéder →</span>
            </Link>
          </div>
        )}

        {role === 'artist' && (
          <div className="mb-6">
            <Link
              href="/dashboard/artiste"
              className="group flex items-center justify-between p-5 border border-gold/30 bg-gold/5 rounded-sm hover:border-gold/60 transition-colors duration-300"
            >
              <div className="flex items-center gap-4">
                <span className="text-gold"><PaletteIcon /></span>
                <div>
                  <p className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300">
                    Espace artiste
                  </p>
                  <p className="font-sans text-xs text-neutral-400 mt-0.5">Gérer vos œuvres et suivre vos ventes</p>
                </div>
              </div>
              <span className="font-sans text-xs text-gold">Accéder →</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { href: '/wishlist', label: 'Ma wishlist',    desc: 'Œuvres sauvegardées',      icon: HeartIcon },
            { href: '/panier',   label: 'Mon panier',     desc: 'Œuvres sélectionnées',     icon: BagIcon   },
            { href: '/galerie',  label: 'La collection',  desc: 'Découvrir les œuvres',     icon: GridIcon  },
          ].map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-6 border border-neutral-200 rounded-sm hover:border-foreground transition-colors duration-300"
            >
              <Icon />
              <div>
                <p className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300">{label}</p>
                <p className="font-sans text-xs text-neutral-400 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Account info */}
        <div className="border border-neutral-200 rounded-sm">
          <div className="px-6 py-4 border-b border-neutral-100">
            <p className="font-sans text-xs uppercase tracking-widest text-neutral-400">Informations du compte</p>
          </div>
          {[
            { label: 'Nom',    value: name  ?? '—' },
            { label: 'Email',  value: email ?? '—' },
            { label: 'Rôle',   value: (session.user as any).role ?? 'user' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 last:border-0">
              <span className="font-sans text-xs uppercase tracking-widest text-neutral-400">{label}</span>
              <span className="font-sans text-sm text-foreground">{value}</span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <div className="mt-8 flex justify-end">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-300"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5"  cy="7.5"  r=".5" fill="currentColor" />
      <circle cx="6.5"  cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  )
}
