import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PLAFOND_PANIER, nettoyerSlugs } from '@/lib/panier/regles'

// Panier du navigateur (AD-13, story 7.2) : seulement des slugs d'œuvres, dédoublonnés et plafonnés.
// Aucun prix, titre ni image n'est gardé : le serveur recompose le panier (module panier). Nouvelle
// clé de stockage : l'ancienne (`errancy-cart`, qui portait des prix) n'est plus lue.

interface CartStore {
  slugs:      string[]
  /** Ajoute un slug ; faux si le panier est plein (plafond) ou si le slug est invalide. */
  addItem:    (slug: string) => boolean
  removeItem: (slug: string) => void
  clearCart:  () => void
  hasItem:    (slug: string) => boolean
}

export const CLE_STOCKAGE_PANIER = 'errancy-panier'
export const ANCIENNE_CLE_PANIER = 'errancy-cart'

/**
 * Reprise de l'ancien panier (clé `errancy-cart`) : seuls les identifiants des articles sont lus, jamais
 * les prix, puis l'ancienne clé est supprimée. Stockage absent, illisible ou corrompu : rien n'est repris.
 */
function reprendreAncienPanier(): string[] {
  try {
    const brut = localStorage.getItem(ANCIENNE_CLE_PANIER)
    if (brut === null) return []
    let ids: unknown[] = []
    try {
      const items = (JSON.parse(brut) as { state?: { items?: unknown } } | null)?.state?.items
      if (Array.isArray(items)) ids = items.map((i) => (i as { id?: unknown } | null)?.id)
    } catch {
      // JSON corrompu : rien à reprendre, la clé est tout de même supprimée.
    }
    localStorage.removeItem(ANCIENNE_CLE_PANIER)
    return nettoyerSlugs(ids)
  } catch {
    return []
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      slugs: [],

      addItem: (slug) => {
        const [propre] = nettoyerSlugs([slug])
        if (!propre) return false
        const { slugs } = get()
        if (slugs.includes(propre)) return true
        if (slugs.length >= PLAFOND_PANIER) return false
        set({ slugs: [...slugs, propre] })
        return true
      },

      removeItem: (slug) => set((state) => ({ slugs: state.slugs.filter((s) => s !== slug) })),

      clearCart: () => set({ slugs: [] }),

      hasItem: (slug) => get().slugs.includes(slug),
    }),
    {
      name: CLE_STOCKAGE_PANIER,
      version: 1,
      partialize: (state) => ({ slugs: state.slugs }),
      // Valeur stockée illisible ou modifiée à la main : seuls des slugs valides sont repris.
      merge: (stocke, actuel) => {
        const propres = nettoyerSlugs((stocke as { slugs?: unknown } | null | undefined)?.slugs)
        const anciens = reprendreAncienPanier()
        const slugs = nettoyerSlugs([...propres, ...anciens])
        if (anciens.length > 0) {
          try {
            localStorage.setItem(CLE_STOCKAGE_PANIER, JSON.stringify({ state: { slugs }, version: 1 }))
          } catch {
            // Écriture refusée : le panier repris vit en mémoire jusqu'au prochain changement.
          }
        }
        return { ...actuel, slugs }
      },
    },
  ),
)
