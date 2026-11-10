import { NextResponse } from 'next/server'
import {
  EVENEMENTS_DU_NAVIGATEUR,
  appliquerChoix,
  enregistrerArrivee,
  mesurer,
  type NomEvenement,
} from '@/lib/mesure'
import { cheminDe, estChoix, slugDuChemin } from '@/lib/mesure/regles'

// Mesure du tunnel (story 4.8) : ce que le navigateur peut signaler. Trois messages : le choix de
// consentement, l'arrivée (source et identifiant, seulement après consentement) et le clic sur
// « Conseil WhatsApp ». Le consentement est relu dans le cookie à chaque événement. Aucune donnée
// personnelle reçue, journalisée ni transmise.

export const dynamic = 'force-dynamic'

const TAILLE_MAX = 4096

const reponse = (ok: boolean, etat: number) => NextResponse.json({ ok }, { status: etat })

export async function POST(requete: Request) {
  // Un envoi sans origine, ou d'un autre site, est refusé (le navigateur indique toujours l'origine d'un POST).
  const origine = requete.headers.get('origin')
  if (!origine) return reponse(false, 403)
  try {
    if (new URL(origine).host !== new URL(requete.url).host) return reponse(false, 403)
  } catch {
    return reponse(false, 403)
  }

  let corps: Record<string, unknown>
  try {
    // Quelques Ko suffisent : corps plus gros refusé sans être analysé.
    const texte = await requete.text()
    if (texte.length > TAILLE_MAX) return reponse(false, 413)
    const lu: unknown = JSON.parse(texte)
    if (!lu || typeof lu !== 'object' || Array.isArray(lu)) return reponse(false, 400)
    corps = lu as Record<string, unknown>
  } catch {
    return reponse(false, 400)
  }

  try {
    if (corps.type === 'consentement') {
      if (!estChoix(corps.choix)) return reponse(false, 400)
      await appliquerChoix(corps.choix, { utm: corps.utm, referent: corps.referent })
      return reponse(true, 200)
    }
    if (corps.type === 'arrivee') {
      enregistrerArrivee({ utm: corps.utm, referent: corps.referent })
      return reponse(true, 200)
    }
    if (corps.type === 'evenement') {
      const nom = corps.nom as NomEvenement
      if (!EVENEMENTS_DU_NAVIGATEUR.includes(nom)) return reponse(false, 400)
      // Le slug du client est ignoré : il vient de la page (`chemin`), jamais d'une valeur forgée.
      const chemin = typeof corps.chemin === 'string' ? cheminDe(corps.chemin) : null
      await mesurer({ nom, slug: slugDuChemin(chemin) }, { chemin })
      return reponse(true, 200)
    }
    return reponse(false, 400)
  } catch {
    console.error('[mesure] route en échec')
    return reponse(false, 500)
  }
}
