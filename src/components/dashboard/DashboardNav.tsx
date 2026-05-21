'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface Props {
  artistSlug: string | null
  mobile?: boolean
}

const navItems = [
  {
    href: '/dashboard/artiste',
    label: 'Vue d\'ensemble',
    icon: HomeIcon,
    exact: true,
  },
  {
    href: '/dashboard/artiste/oeuvres',
    label: 'Mes œuvres',
    icon: GridIcon,
    exact: false,
  },
  {
    href: '/dashboard/artiste/oeuvres/nouvelle',
    label: 'Ajouter',
    icon: PlusIcon,
    exact: true,
  },
]

export function DashboardNav({ mobile = false }: Props) {
  const pathname = usePathname()

  if (mobile) {
    return (
      <nav className="flex items-center justify-around px-4 h-16">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && !(exact && pathname !== href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2',
                'font-sans text-[10px] uppercase tracking-widest',
                'transition-colors duration-200',
                active ? 'text-foreground' : 'text-neutral-400 hover:text-foreground',
              )}
            >
              <Icon active={active} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex flex-col gap-1">
      <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-4 px-3">
        Navigation
      </p>
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname.startsWith(href) && !navItems.find(n => n.exact && n.href !== href && pathname.startsWith(n.href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-sm',
              'font-sans text-xs uppercase tracking-widest',
              'transition-all duration-200',
              active
                ? 'bg-foreground text-background'
                : 'text-neutral-500 hover:text-foreground hover:bg-neutral-100',
            )}
          >
            <Icon active={active} />
            {label}
          </Link>
        )
      })}

      <div className="mt-8 pt-8 border-t border-neutral-100">
        <Link
          href="/galerie"
          className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-foreground transition-colors duration-200"
        >
          <ExternalIcon />
          <span className="font-sans text-xs uppercase tracking-widest">Voir la galerie</span>
        </Link>
      </div>
    </nav>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function PlusIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
