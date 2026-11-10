import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { URL_SITE } from '@/lib/reglages'
import { estNomEvenement, slugValide, type EvenementMesure } from './catalogue'
import { mesureActive } from './choix'
import { compterChoix } from './compteur'
import {
  COOKIES_DE_MESURE,
  COOKIE_CHOIX,
  COOKIE_SOURCE,
  COOKIE_VISITEUR,
  DUREE_CHOIX_SECONDES,
  cheminDe,
  cheminMesurable,
  lireChoix,
  slugDuChemin,
  sourceArrivee,
  valeurChoix,
  type ChoixConsentement,
} from './regles'

// Mesure côté serveur (story 4.8, FR-27, AD-19, NFR-6). Rien ne part sans le consentement lu dans le
// cookie à chaque événement, ni depuis une page hors de la liste blanche, ni pour un administrateur.
// Une erreur de mesure n'atteint jamais l'action du visiteur ; aucune donnée personnelle journalisée.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SOURCE = /^[a-z0-9._-]{1,80}$/

function hotesDuSite(): string[] {
  const hotes = [new URL(URL_SITE).host]
  const hote = headers().get('host')
  if (hote) hotes.push(hote)
  return hotes
}

function optionsCookie(dureeSecondes?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(dureeSecondes ? { maxAge: dureeSecondes } : {}),
  }
}

/** Choix de consentement du visiteur, relu dans le cookie. */
export function choixDuVisiteur(): ChoixConsentement | null {
  return lireChoix(cookies().get(COOKIE_CHOIX)?.value)
}

/**
 * Mesure un événement. `chemin` est la page où il se produit (sans paramètres) ; `utm` le paramètre
 * `utm_source` de la page, quand elle le connaît (la source déjà gardée dans le cookie l'emporte).
 * Ne lève jamais d'erreur.
 */
export async function mesurer(
  evenement: EvenementMesure,
  options: { chemin: string | null; utm?: string | null },
): Promise<void> {
  try {
    if (!estNomEvenement(evenement.nom)) return
    if (!cheminMesurable(options.chemin)) return
    const jar = cookies()
    if (lireChoix(jar.get(COOKIE_CHOIX)?.value) !== 'accepte') return
    // Aucun événement des administrateurs : rôle relu en base (AD-15). Un doute = rien.
    // Import tardif : l'authentification n'entre dans le graphe d'import des actions et des pages qu'au
    // moment où le visiteur a consenti (et ne pèse ni sur les tests ni sur les composants qui importent ces actions).
    const { acteurCourant } = await import('@/lib/acces')
    const acteur = await acteurCourant()
    if (acteur.type === 'admin') return

    const gardee = jar.get(COOKIE_SOURCE)?.value
    const source =
      gardee && SOURCE.test(gardee)
        ? gardee
        : sourceArrivee({ utm: options.utm, referent: headers().get('referer'), hotes: hotesDuSite() })
    const id = jar.get(COOKIE_VISITEUR)?.value
    await mesureActive().envoyer({
      nom: evenement.nom,
      slug: slugValide(evenement.slug),
      source,
      visiteur: id && UUID.test(id) ? id : randomUUID(),
    })
  } catch (erreur) {
    console.error('[mesure] échec', erreur instanceof Error ? erreur.name : 'inconnu')
  }
}

/**
 * Mesure un événement issu d'une action serveur : la page est celle du référent de la requête ; sans
 * slug donné, celui de la page de fiche. Ne lève jamais d'erreur.
 */
export async function mesurerDepuisAction(evenement: EvenementMesure): Promise<void> {
  try {
    const chemin = cheminDe(headers().get('referer'))
    await mesurer({ ...evenement, slug: evenement.slug !== undefined ? evenement.slug : slugDuChemin(chemin) }, { chemin })
  } catch {
    console.error('[mesure] échec')
  }
}

/** Garde l'identifiant du visiteur et la source d'arrivée, seulement après consentement. */
export function enregistrerArrivee(arrivee: { utm?: unknown; referent?: unknown }): void {
  if (lireChoix(cookies().get(COOKIE_CHOIX)?.value) !== 'accepte') return
  poserArrivee(arrivee)
}

function poserArrivee(arrivee: { utm?: unknown; referent?: unknown }): void {
  const jar = cookies()
  const id = jar.get(COOKIE_VISITEUR)?.value
  if (!id || !UUID.test(id)) jar.set(COOKIE_VISITEUR, randomUUID(), optionsCookie(DUREE_CHOIX_SECONDES))
  const source = jar.get(COOKIE_SOURCE)?.value
  if (!source || !SOURCE.test(source)) {
    const trouvee = sourceArrivee({ utm: arrivee.utm, referent: arrivee.referent, hotes: hotesDuSite() })
    // Cookie de session : la source vaut pour la visite en cours.
    if (trouvee) jar.set(COOKIE_SOURCE, trouvee, optionsCookie())
  }
}

/**
 * Applique le choix du visiteur : cookie du choix (un an), compteur du jour, et cookies de mesure
 * posés (accepté) ou supprimés (refusé, retrait). Un compteur en échec ne défait pas le choix.
 */
export async function appliquerChoix(choix: ChoixConsentement, arrivee: { utm?: unknown; referent?: unknown } = {}): Promise<void> {
  const jar = cookies()
  jar.set(COOKIE_CHOIX, valeurChoix(choix), optionsCookie(DUREE_CHOIX_SECONDES))
  if (choix === 'refuse') {
    for (const nom of COOKIES_DE_MESURE) jar.delete(nom)
  } else {
    try {
      poserArrivee(arrivee)
    } catch {
      console.error('[mesure] arrivée non enregistrée')
    }
  }
  try {
    await compterChoix(choix)
  } catch (erreur) {
    console.error('[mesure] compteur indisponible', erreur instanceof Error ? erreur.name : 'inconnu')
  }
}
