import { fr, heureMurale } from '@/lib/i18n'
import { CONSEIL_HORAIRES, DELAI_CONSEIL_HEURES, DELAI_REPONSE_DEMANDE_HEURES, urlAbsolue } from '@/lib/reglages'

// Conseil WhatsApp (story 4.4, FR-7, UX-DR14) : calculs purs (aucun accès à la base, aucune lecture
// de l'environnement) du message prérempli, du lien `wa.me`, de l'état « dans les horaires » et de
// la sous-ligne du bouton. Le numéro est lu par `reglages` (variable `WHATSAPP_NUMERO`) et passé
// en paramètre : il n'apparaît que dans le lien du bouton.

export type ContexteConseil =
  | { type: 'oeuvre'; slug: string; titre: string }
  | { type: 'artiste'; nom: string }
  | { type: 'general' }

/** Message prérempli ; titre ou nom absent (vide) : message général. */
export function messageConseil(contexte: ContexteConseil): string {
  const t = fr.conseilWhatsApp.messages
  if (contexte.type === 'oeuvre' && contexte.titre.trim() && contexte.slug.trim()) {
    return t.oeuvre(contexte.titre.trim(), contexte.slug.trim(), urlAbsolue(`/galerie/${encodeURIComponent(contexte.slug.trim())}`))
  }
  if (contexte.type === 'artiste' && contexte.nom.trim()) return t.artiste(contexte.nom.trim())
  return t.general
}

/**
 * Numéro réglé → chiffres seuls, format international (« + », espaces, points, tirets et parenthèses
 * retirés, « 00 » initial pris pour « + »). null si absent, non numérique, ou hors de 8 à 15 chiffres
 * (norme E.164) : le bouton passe alors au repli, sans erreur.
 */
export function normaliserNumero(brut: string | null | undefined): string | null {
  if (!brut) return null
  const net = brut.trim()
  if (!/^\+?[\d\s().-]+$/.test(net)) return null
  let chiffres = net.replace(/\D/g, '')
  if (net.startsWith('+') === false && chiffres.startsWith('00')) chiffres = chiffres.slice(2)
  return /^[1-9]\d{7,14}$/.test(chiffres) ? chiffres : null
}

/** Lien `https://wa.me/<numéro>?text=<message encodé>` ; null si le numéro n'est pas valide. */
export function lienWhatsApp(numero: string | null | undefined, message: string): string | null {
  const n = normaliserNumero(numero)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null
}

export type EtatConseil =
  | { ouvert: true }
  | { ouvert: false; prochaine: 'aujourdhui' | 'demain' | 'lundi' }

/**
 * Horaires de réponse à un instant : dans les horaires (jours et heures de `CONSEIL_HORAIRES`, lus
 * dans son fuseau par `heureMurale`, heure d'été comprise), sinon la prochaine ouverture — « aujourd'hui »
 * avant l'ouverture, « demain » du lundi au jeudi soir, « lundi » le vendredi soir et le week-end.
 */
export function etatConseil(maintenant: Date, horaires: typeof CONSEIL_HORAIRES = CONSEIL_HORAIRES): EtatConseil {
  const mur = heureMurale(maintenant, horaires.fuseau)
  const m = mur === null ? null : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(mur)
  // Fuseau illisible : le plus prudent est de ne rien promettre d'immédiat.
  if (!m) return { ouvert: false, prochaine: 'lundi' }
  const jour = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  const heure = Number(m[4])
  const ouvrable = (horaires.jours as readonly number[]).includes(jour)
  if (ouvrable && heure >= horaires.debut && heure < horaires.fin) return { ouvert: true }
  if (ouvrable && heure < horaires.debut) return { ouvert: false, prochaine: 'aujourdhui' }
  if (!ouvrable) return { ouvert: false, prochaine: 'lundi' }
  const demain = (jour + 1) % 7
  return { ouvert: false, prochaine: (horaires.jours as readonly number[]).includes(demain) ? 'demain' : 'lundi' }
}

/** Sous-ligne du bouton quand WhatsApp est actif : délai et horaires, ou prochaine ouverture. */
export function sousLigneConseil(etat: EtatConseil, horaires: typeof CONSEIL_HORAIRES = CONSEIL_HORAIRES): string {
  const t = fr.conseilWhatsApp
  if (etat.ouvert) {
    return t.ouvert(DELAI_CONSEIL_HEURES, `${t.horaires(horaires.debut, horaires.fin)} ${t.fuseau}`)
  }
  return t.ferme[etat.prochaine](horaires.debut)
}

export type BoutonConseil =
  | { mode: 'whatsapp'; href: string; sousLigne: string }
  | { mode: 'repli'; href: '/conseil'; sousLigne: string }

/**
 * Ce que le bouton affiche : lien WhatsApp avec message prérempli et horaires si le numéro est
 * valide ; sinon repli vers `/conseil` avec le délai réellement tenu (`DELAI_REPONSE_DEMANDE_HEURES`),
 * jamais celui de WhatsApp.
 */
export function boutonConseil(p: { numero: string | null | undefined; contexte: ContexteConseil; maintenant: Date }): BoutonConseil {
  const href = lienWhatsApp(p.numero, messageConseil(p.contexte))
  if (href === null) return { mode: 'repli', href: '/conseil', sousLigne: fr.conseilWhatsApp.repli(DELAI_REPONSE_DEMANDE_HEURES) }
  return { mode: 'whatsapp', href, sousLigne: sousLigneConseil(etatConseil(p.maintenant)) }
}
