// Réglages lus côté serveur (AD-17). L'ouverture du Lot 2 est un geste du porteur,
// comme MAINTENANCE_MODE : variable Vercel LOT2_OUVERT.

// Seule fonction qui dit si le Lot 2 (achat en ligne) est ouvert : uniquement si
// LOT2_OUVERT vaut « oui ». Absente ou toute autre valeur : fermé.
export function lot2Ouvert(env: Record<string, string | undefined> = process.env): boolean {
  return env.LOT2_OUVERT?.trim().toLowerCase() === 'oui'
}

// Limitation des envois du formulaire « Me notifier » de la page de maintenance (FR-35) :
// au plus `parIp` envois par adresse IP et `parEmail` par e-mail sur `fenetreMinutes`.
export const LIMITES_INSCRIPTION_OUVERTURE = { fenetreMinutes: 60, parIp: 10, parEmail: 3 } as const
