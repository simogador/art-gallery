import { NextResponse, type NextRequest } from 'next/server'
import { lireLienSuivi } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { CHEMIN_COOKIE_SUIVI, COOKIE_SUIVI, optionsCookieSuivi } from '../cookie'

// Ouverture du lien de suivi d'un acheteur sans compte (FR-15, AD-14, story 7.7) : le jeton est échangé contre
// un cookie httpOnly, puis l'URL est redirigée sans jeton. Le jeton n'est pas consommé (le lien de l'e-mail
// se rouvre jusqu'à son échéance). Aucune écriture : une valeur mal formée n'ouvre même pas de transaction.
// Jamais journalisé ; seule cette première requête le porte dans son chemin (limite d'AD-14). Hors mesure.

export const dynamic = 'force-dynamic'

function echapper(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 503 neutre : page minimale, aucun cookie, aucune donnée ; `Réessayer` rouvre le lien de l'e-mail. */
function panne() {
  const t = fr.suivi.echange
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${echapper(t.titre)}</title></head><body style="font-family:Georgia,serif;padding:24px;max-width:560px;margin:0 auto"><h1>${echapper(t.titre)}</h1><p>${echapper(t.texte)}</p><p><a href="">${echapper(t.reessayer)}</a></p></body></html>`
  return new NextResponse(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Retry-After': '30' },
  })
}

export async function GET(req: NextRequest, { params }: { params: { jeton: string } }) {
  const reponse = NextResponse.redirect(new URL('/suivi', req.nextUrl), 303)
  reponse.headers.set('Referrer-Policy', 'no-referrer')
  reponse.headers.set('Cache-Control', 'no-store')
  let lien: Awaited<ReturnType<typeof lireLienSuivi>>
  try {
    lien = await lireLienSuivi(params.jeton)
  } catch (erreur) {
    // Panne de la base : on ne sait rien du lien. Jamais la page « close » (elle dirait à tort que la commande
    // est close) : 503 neutre, sans cookie, qui invite à rouvrir le lien de l'e-mail. Journal sans jeton.
    console.error('suivi_echange_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return panne()
  }
  if (lien) {
    reponse.cookies.set(COOKIE_SUIVI, params.jeton, optionsCookieSuivi(lien.echeance))
  } else if (req.cookies.get(COOKIE_SUIVI)?.value === params.jeton) {
    // Le cookie d'un suivi encore valable (autre lien) n'est effacé que s'il porte ce jeton-là.
    reponse.cookies.delete({ name: COOKIE_SUIVI, path: CHEMIN_COOKIE_SUIVI })
  }
  return reponse
}
