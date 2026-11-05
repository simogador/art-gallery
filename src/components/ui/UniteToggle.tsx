'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  cookieUnite,
  formaterDimensions,
  formaterDimensionsDouble,
  fr,
  SEPARATEUR,
  UNITE_PAR_DEFAUT,
  UNITES,
  type MillimetresAffiches,
  type Unite,
} from '@/lib/i18n'

// Story 3.2 (FR-17, UX-DR21) : unité des dimensions choisie par le visiteur. Le layout racine lit le
// cookie `unite` côté serveur et la passe à UniteProvider (rendu sans clignotement) ; la bascule
// écrit le cookie (un an) et met à jour tout le site sans rechargement.

const ContexteUnite = createContext<{ unite: Unite; choisir: (u: Unite) => void }>({
  unite: UNITE_PAR_DEFAUT,
  choisir: () => {},
})

export function UniteProvider({ initiale, children }: { initiale: Unite; children: React.ReactNode }) {
  const [unite, setUnite] = useState<Unite>(initiale)
  // Nouvelle valeur venue du serveur (navigation, rafraîchissement) : elle l'emporte.
  useEffect(() => setUnite(initiale), [initiale])
  const choisir = useCallback((u: Unite) => {
    setUnite(u)
    try {
      document.cookie = cookieUnite(u)
    } catch {
      // Cookies bloqués : le choix vaut pour la page ouverte seulement.
    }
  }, [])
  return <ContexteUnite.Provider value={{ unite, choisir }}>{children}</ContexteUnite.Provider>
}

/** Unité choisie (cm par défaut). */
export function useUnite(): Unite {
  return useContext(ContexteUnite).unite
}

/**
 * Dimensions dans l'unité choisie, pour un composant serveur (« 61 × 76 cm »). `double` : les deux
 * unités, celle choisie d'abord, l'autre entre parenthèses avec `complement` (« 61 × 76 cm (24 × 29,9 in · paysage) »).
 * `vide` sans hauteur ni largeur.
 */
export function DimensionsChoisies({
  mm,
  double = false,
  complement,
  vide = '',
}: {
  mm: MillimetresAffiches
  double?: boolean
  complement?: string
  vide?: string
}) {
  const unite = useUnite()
  let texte = formaterDimensions(mm, unite)
  if (double) {
    const deux = formaterDimensionsDouble(mm, unite)
    texte = deux ? `${deux[0]} (${deux[1]}${complement ? SEPARATEUR + complement : ''})` : ''
  }
  return <>{texte || vide}</>
}

/**
 * Contrôle segmenté « cm / in » (DESIGN.md) : cibles de 44 px, état annoncé par aria-pressed, nom
 * complet de l'unité pour les lecteurs d'écran. `libelleId` : id d'un libellé visible du groupe ;
 * sans lui, le groupe porte le libellé du dictionnaire.
 */
export function UniteToggle({ className, libelleId }: { className?: string; libelleId?: string }) {
  const { unite, choisir } = useContext(ContexteUnite)
  const textes = fr.unite
  return (
    <div
      role="group"
      aria-labelledby={libelleId}
      aria-label={libelleId ? undefined : textes.libelle}
      className={cn('inline-flex items-stretch border border-neutral-200 rounded-sm', className)}
    >
      {UNITES.map((u) => {
        const actif = u === unite
        return (
          <button
            key={u}
            type="button"
            aria-pressed={actif}
            aria-label={textes.nomComplet[u]}
            onClick={() => choisir(u)}
            className={cn(
              'min-h-touch-target min-w-touch-target px-3 font-sans text-button',
              'transition-colors duration-200',
              actif ? 'fond-sombre bg-foreground text-background' : 'bg-transparent text-neutral-600 hover:text-foreground',
            )}
          >
            {textes[u]}
          </button>
        )
      })}
    </div>
  )
}
