// Fonction pure d'affichage. Story 2.9 : les lectures d'œuvres passent par le module catalogue ;
// les anciennes fonctions lues dans src/data (démonstration) ont été supprimées.

export function formatPrice(price: number): string {
  return price.toLocaleString('fr-FR') + ' €'
}
