'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { MARQUE_ENVOI } from './marque'

// Après un envoi réussi (marque `sessionStorage` posée par le formulaire), place le focus sur son contenu
// au montage et purge la marque : une seule fois, simple confort du visiteur (story 7.3).
export function FocusSiMarque({ children }: { children: ReactNode }) {
  const zone = useRef<HTMLDivElement>(null)
  useEffect(() => {
    try {
      if (sessionStorage.getItem(MARQUE_ENVOI) === '1') {
        sessionStorage.removeItem(MARQUE_ENVOI)
        zone.current?.focus()
      }
    } catch {
      // Stockage indisponible : pas de focus déplacé.
    }
  }, [])
  return (
    <div ref={zone} tabIndex={-1} className="focus:outline-none">
      {children}
    </div>
  )
}
