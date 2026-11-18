'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/store/cart'

// Retire du panier du navigateur les œuvres des commandes CONFIRMÉES (story 7.6), et elles seules : jamais
// celles d'une commande en attente ou annulée, ni un panier neuf d'autres œuvres.
export function CartClearer({ slugs }: { slugs: string[] }) {
  const cle = slugs.join('|')
  useEffect(() => {
    const aRetirer = cle === '' ? [] : cle.split('|')
    if (aRetirer.length === 0) return
    useCartStore.setState((s) => ({ slugs: s.slugs.filter((x) => !aRetirer.includes(x)) }))
  }, [cle])
  return null
}
