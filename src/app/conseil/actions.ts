'use server'

import { headers } from 'next/headers'
import { enregistrerDemandeSelection, type ErreursSelection } from '@/lib/demandes'
import { mesurerDepuisAction } from '@/lib/mesure'

// Demande de sélection personnalisée (story 4.2, FR-8) : action serveur du formulaire `/conseil`.
// Le module demandes revérifie toute la saisie, limite les envois et écrit la demande ; ici seulement
// l'adresse IP de la requête (pour la limite) et des réponses sans détail technique.

export type ReponseDemande =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursSelection }
  | { ok: false; code: 'trop_de_demandes' | 'indisponible' }

function adresseIp(): string | null {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function envoyerDemandeSelection(saisie: unknown): Promise<ReponseDemande> {
  try {
    const reponse = await enregistrerDemandeSelection(saisie, adresseIp())
    // Story 4.8 : demande envoyée, mesurée sans aucune de ses données (ni e-mail, ni texte saisi).
    if (reponse.ok) await mesurerDepuisAction({ nom: 'DemandeEnvoyee', slug: null })
    return reponse
  } catch (erreur) {
    // Jamais la saisie, l'e-mail ni l'IP dans les journaux : seulement le type et le code de l'erreur.
    const code = (erreur as { code?: unknown } | null)?.code
    console.error('[conseil] échec', erreur instanceof Error ? erreur.name : 'inconnu', typeof code === 'string' ? code : '')
    return { ok: false, code: 'indisponible' }
  }
}
