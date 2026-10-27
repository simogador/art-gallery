// Réglages lus côté serveur (AD-17). L'ouverture du Lot 2 est un geste du porteur,
// comme MAINTENANCE_MODE : variable Vercel LOT2_OUVERT.

// Seule fonction qui dit si le Lot 2 (achat en ligne) est ouvert : uniquement si
// LOT2_OUVERT vaut « oui ». Absente ou toute autre valeur : fermé.
export function lot2Ouvert(env: Record<string, string | undefined> = process.env): boolean {
  return env.LOT2_OUVERT?.trim().toLowerCase() === 'oui'
}
