'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  apiUrl:  string
  label:   string
  confirm: string
  redirectTo?: string
}

export function DeleteButton({ apiUrl, label, confirm, redirectTo }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!window.confirm(confirm)) return
    setLoading(true)
    try {
      const res = await fetch(apiUrl, { method: 'DELETE' })
      if (res.ok) {
        if (redirectTo) router.push(redirectTo)
        else router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? '…' : label}
    </button>
  )
}
