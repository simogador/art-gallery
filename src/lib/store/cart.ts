import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id:          string
  title:       string
  artist:      string
  artistId:    string
  price:       number
  imageUrl:    string | null
  gradient:    string
  accentColor: string
}

interface CartStore {
  items:      CartItem[]
  addItem:    (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart:  () => void
  hasItem:    (id: string) => boolean
  total:      () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          if (state.items.find((i) => i.id === item.id)) return state
          return { items: [...state.items, item] }
        }),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      clearCart: () => set({ items: [] }),

      hasItem: (id) => get().items.some((i) => i.id === id),

      total: () => get().items.reduce((sum, i) => sum + i.price, 0),
    }),
    { name: 'errancy-cart' },
  ),
)
