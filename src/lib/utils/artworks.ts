// Fonction pure d'affichage. Story 2.9 : les lectures d'œuvres passent par le module catalogue ;
// les anciennes fonctions lues dans src/data (démonstration) ont été supprimées.

// Story 3.2 : délègue à formaterMontant (« 1 450 € », espaces fines insécables).

import { formaterMontant } from '@/lib/i18n/formats'

/** Montant en euros (type d'affichage `price`) → « 1 450 € » ; préférer formaterMontant(centimes). */
export function formatPrice(price: number): string {
  return formaterMontant(Math.round(price * 100))
}
