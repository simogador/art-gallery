'use client'

import { MotionConfig } from 'framer-motion'

// Story 3.1 (UX-DR6) : framer-motion suit le réglage système « réduire les animations »
// (déplacements et changements d'échelle coupés) ; la règle CSS de globals.css fait de même
// pour les animations et transitions Tailwind.
export function MouvementReduit({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
