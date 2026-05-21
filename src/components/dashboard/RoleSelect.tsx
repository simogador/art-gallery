'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const ROLES = ['user', 'artist', 'admin'] as const
type Role = typeof ROLES[number]

const colors: Record<Role, string> = {
  user:   'bg-neutral-100 text-neutral-600 border-neutral-200',
  artist: 'bg-violet-50 text-violet-700 border-violet-200',
  admin:  'bg-amber-50 text-amber-700 border-amber-200',
}

interface Props {
  userId:      string
  currentRole: Role
}

export function RoleSelect({ userId, currentRole }: Props) {
  const [role,    setRole]    = useState<Role>(currentRole)
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const router = useRouter()

  async function changeRole(newRole: Role) {
    if (newRole === role) { setOpen(false); return }
    setLoading(true)
    setOpen(false)
    const prev = role
    setRole(newRole)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${userId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role: newRole }),
      })
      if (!res.ok) setRole(prev)
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest',
          'px-2.5 py-1 rounded-sm border transition-all duration-200',
          'disabled:opacity-50 cursor-pointer hover:opacity-80',
          colors[role],
        )}
      >
        {loading ? '…' : role}
        <ChevronIcon />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-neutral-200 rounded-sm shadow-lg py-1 min-w-[100px]">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => changeRole(r)}
                className={cn(
                  'w-full text-left px-3 py-2 font-sans text-xs uppercase tracking-widest',
                  'hover:bg-neutral-50 transition-colors duration-150',
                  r === role ? 'text-foreground font-medium' : 'text-neutral-500',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
