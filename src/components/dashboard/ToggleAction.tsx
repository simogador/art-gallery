'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface Props {
  value:    boolean
  apiUrl:   string
  field:    string
  labelOn:  string
  labelOff: string
  colorOn?: 'green' | 'gold' | 'blue'
}

export function ToggleAction({ value, apiUrl, field, labelOn, labelOff, colorOn = 'green' }: Props) {
  const [current, setCurrent] = useState(value)
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    setCurrent((v) => !v)
    try {
      const res = await fetch(apiUrl, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: !current }),
      })
      if (!res.ok) { setCurrent(current); return }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const colorMap = {
    green: current ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200',
    gold:  current ? 'bg-gold/10 text-gold border-gold/30' : 'bg-neutral-100 text-neutral-500 border-neutral-200',
    blue:  current ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200',
  }
  const dotMap = {
    green: current ? 'bg-emerald-500' : 'bg-neutral-400',
    gold:  current ? 'bg-gold'        : 'bg-neutral-400',
    blue:  current ? 'bg-blue-500'    : 'bg-neutral-400',
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest',
        'px-2.5 py-1 rounded-sm border transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:opacity-80',
        colorMap[colorOn],
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full transition-colors', dotMap[colorOn])} />
      {current ? labelOn : labelOff}
    </button>
  )
}
