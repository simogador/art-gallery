'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const NAV = [
  { href: '/dashboard/admin',              label: 'Vue d\'ensemble', icon: HomeIcon,   exact: true  },
  { href: '/dashboard/admin/artistes',     label: 'Artistes',        icon: UserIcon,   exact: false },
  { href: '/dashboard/admin/oeuvres',      label: 'Œuvres',          icon: GridIcon,   exact: false },
  { href: '/dashboard/admin/utilisateurs', label: 'Utilisateurs',    icon: UsersIcon,  exact: false },
] as const

function isActive(href: string, exact: boolean, pathname: string): boolean {
  return exact ? pathname === href : pathname.startsWith(href)
}

export function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()

  if (mobile) {
    return (
      <nav className="flex items-center justify-around px-2 h-16">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact, pathname)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-2',
                'font-sans text-[10px] uppercase tracking-widest transition-colors duration-200',
                active ? 'text-foreground' : 'text-neutral-400 hover:text-foreground',
              )}>
              <Icon active={active} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex flex-col gap-1 flex-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact, pathname)
        return (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-sm',
              'font-sans text-xs uppercase tracking-widest transition-all duration-200',
              active
                ? 'bg-foreground text-background'
                : 'text-neutral-500 hover:text-foreground hover:bg-neutral-100',
            )}>
            <Icon active={active} />
            {label}
          </Link>
        )
      })}

      <div className="mt-auto pt-8 border-t border-neutral-100">
        <Link href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-foreground transition-colors duration-200">
          <BackIcon />
          <span className="font-sans text-xs uppercase tracking-widest">Mon compte</span>
        </Link>
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}
function UserIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
function GridIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
}
function UsersIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function BackIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
}
