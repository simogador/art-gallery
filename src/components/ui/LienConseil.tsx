'use client'

import type { AnchorHTMLAttributes } from 'react'
import { signalerClicConseil } from '@/lib/mesure/client'

// Story 4.8 : lien du bouton Conseil WhatsApp qui signale le clic à la mesure, sans l'attendre : le
// lien s'ouvre aussitôt, même si la mesure échoue ou si le visiteur n'a pas consenti (le serveur
// relit le consentement et ne mesure rien dans ce cas). `mesure` : vrai seulement quand le lien est
// celui de WhatsApp (le repli vers `/conseil` n'est pas un clic WhatsApp).

export function LienConseil({
  slug,
  mesure,
  ...lien
}: AnchorHTMLAttributes<HTMLAnchorElement> & { slug: string | null; mesure: boolean }) {
  return <a {...lien} onClick={mesure ? () => signalerClicConseil(slug) : undefined} />
}
