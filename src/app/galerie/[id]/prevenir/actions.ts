'use server'

import { headers } from 'next/headers'
import { enregistrerInscriptionPrevenir, type ErreursPrevenir } from '@/lib/demandes'

// « Me prévenir » (story 4.5, FR-9) : action serveur du formulaire `/galerie/[id]/prevenir`. Le module
// demandes revérifie l'œuvre et la saisie, limite les envois et écrit l'inscription ; ici seulement
// l'adresse IP de la requête (pour la limite) et des réponses sans détail technique. Aucune mesure :
// l'inscription n'est pas un événement du catalogue de la 4.8.

export type ReponsePrevenir =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursPrevenir }
  | { ok: false; code: 'trop_de_demandes' | 'oeuvre_indisponible' | 'indisponible' }

function adresseIp(): string | null {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function envoyerInscriptionPrevenir(slug: string, saisie: unknown): Promise<ReponsePrevenir> {
  try {
    return await enregistrerInscriptionPrevenir(saisie, { ip: adresseIp(), slug })
  } catch (erreur) {
    // Jamais la saisie, l'e-mail ni l'IP dans les journaux : le type et le code seulement.
    const code = (erreur as { code?: unknown } | null)?.code
    console.error('[prevenir] échec', erreur instanceof Error ? erreur.name : 'inconnu', typeof code === 'string' ? code : '')
    return { ok: false, code: 'indisponible' }
  }
}
