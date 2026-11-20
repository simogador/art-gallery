'use client'

import { useEffect, useState } from 'react'
import { formaterDateHeure, fuseauAppareil } from '@/lib/i18n'

// Date et heure fixes dans le fuseau de l'appareil (story 8.1, AD-10, UXQ-10) : « 21 novembre 2026 à 15 h 42 ».
// Jamais de compte à rebours ni de couleur. Le serveur ne connaît pas le fuseau : le texte s'écrit après le
// montage ; avant, l'élément `time` porte la date ISO seulement.

export function HeureFixe({ iso }: { iso: string }) {
  const [texte, setTexte] = useState<string | null>(null)
  useEffect(() => setTexte(formaterDateHeure(iso, { fuseau: fuseauAppareil() })), [iso])
  return <time dateTime={iso}>{texte}</time>
}
