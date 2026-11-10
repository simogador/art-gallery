'use server'

import { headers } from 'next/headers'
import { enregistrerDemandeVisite, type ErreursVisite } from '@/lib/demandes'

// Demande de visite (story 4.3, FR-8) : action serveur du formulaire `/galerie/[id]/visite`. Le module
// demandes revérifie l'œuvre et toute la saisie, limite les envois et écrit la demande ; ici seulement
// l'adresse IP de la requête (pour la limite) et des réponses sans détail technique.

export type ReponseVisite =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursVisite }
  | { ok: false; code: 'trop_de_demandes' | 'oeuvre_indisponible' | 'indisponible' }

function adresseIp(): string | null {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function envoyerDemandeVisite(slug: string, saisie: unknown): Promise<ReponseVisite> {
  try {
    return await enregistrerDemandeVisite(slug, saisie, adresseIp())
  } catch (erreur) {
    // Jamais la saisie, l'e-mail, les créneaux ni l'IP dans les journaux : le type et le code seulement.
    const code = (erreur as { code?: unknown } | null)?.code
    console.error('[visite] échec', erreur instanceof Error ? erreur.name : 'inconnu', typeof code === 'string' ? code : '')
    return { ok: false, code: 'indisponible' }
  }
}
