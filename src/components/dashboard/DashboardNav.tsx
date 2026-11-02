'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

// Navigation de l'espace artiste (story 2.4, artist-tabbar) : quatre onglets texte, en bas sur
// mobile, latérale à partir de `lg` ; onglet courant en noir gras, annoncé par aria-current.

interface Props {
  mobile?: boolean
}

const NAV = [
  { href: '/dashboard/artiste',           label: 'Accueil',   exact: true  },
  { href: '/dashboard/artiste/oeuvres',   label: 'Œuvres',    exact: false },
  { href: '/dashboard/artiste/commandes', label: 'Commandes', exact: false },
  { href: '/dashboard/artiste/paiements', label: 'Paiements', exact: false },
] as const

function isActive(href: string, exact: boolean, pathname: string): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardNav({ mobile = false }: Props) {
  const pathname = usePathname()

  if (mobile) {
    return (
      <nav aria-label="Espace artiste" className="grid grid-cols-4 h-16">
        {NAV.map(({ href, label, exact }) => {
          const active = isActive(href, exact, pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center justify-center min-h-[44px] border-t-2',
                'font-sans text-xs transition-colors duration-200',
                active ? 'border-foreground text-foreground font-semibold' : 'border-transparent text-neutral-600 hover:text-foreground',
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label="Espace artiste" className="flex flex-col gap-1 flex-1">
      {NAV.map(({ href, label, exact }) => {
        const active = isActive(href, exact, pathname)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center min-h-[44px] px-3 rounded-sm',
              'font-sans text-xs uppercase tracking-widest transition-all duration-200',
              active ? 'bg-foreground text-background font-semibold' : 'text-neutral-600 hover:text-foreground hover:bg-neutral-100',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
