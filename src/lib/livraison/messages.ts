import { nomPays } from './pays'

// Refus du module livraison et leurs textes (sans accès à la base : importable côté client).

export const LONGUEUR_MAX_NOM = 60

export type RefusZone =
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'nom_invalide' | 'nom_pris' }
  | { ok: false; code: 'pays_inconnu'; pays: string[] }
  | { ok: false; code: 'pays_deja_pris'; pays: { code: string; zone: string }[] }
  | { ok: false; code: 'zone_utilisee'; offres: number }

export function messageRefusZone(refus: RefusZone): string {
  switch (refus.code) {
    case 'acces_refuse':
      return 'Seule l’équipe Errancy peut modifier les zones de livraison.'
    case 'introuvable':
      return 'Cette zone n’existe plus.'
    case 'nom_invalide':
      return `Indiquez un nom de zone (${LONGUEUR_MAX_NOM} caractères au plus).`
    case 'nom_pris':
      return 'Une zone porte déjà ce nom.'
    case 'pays_inconnu':
      return `Code pays inconnu : ${refus.pays.join(', ')}.`
    case 'pays_deja_pris':
      return refus.pays.length
        ? `Déjà dans une autre zone : ${refus.pays.map((p) => `${nomPays(p.code)} (${p.zone})`).join(', ')}. Retirez-les d’abord de cette zone.`
        : 'Un pays choisi vient d’être ajouté à une autre zone. Rechargez la page.'
    case 'zone_utilisee':
      return `Cette zone est utilisée par ${refus.offres} offre${refus.offres > 1 ? 's' : ''} de livraison : elle ne peut pas être supprimée.`
  }
}
