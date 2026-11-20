import { DATE_ABSENTE, fr, formaterDateHeure, formaterMontant } from '@/lib/i18n'
import type { TypeVisite } from '@/lib/demandes/visite-regles'
import { lienWhatsApp, messageConseil } from '@/lib/conseil'
import { CONTACT_EQUIPE, DELAI_REPONSE_DEMANDE_HEURES, DUREE_INVITATION_JOURS, numeroWhatsApp } from '@/lib/reglages'

// Contenus des e-mails transactionnels (story 4.1) : textes du dictionnaire `fr`, vouvoiement. Pur
// (aucun accès à la base). Chaque e-mail se termine par l'adresse de l'équipe, précédée (story 4.4)
// du lien Conseil WhatsApp quand le numéro est réglé (message général) ; sans numéro, le pied reste
// inchangé.

export type Contenu = { sujet: string; texte: string; html: string }

export function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type Gabarit = {
  sujet: string
  /** Absent : « Bonjour, » (visiteur ou équipe, sans nom). */
  nom?: string
  /** Paragraphes d'introduction. */
  intro: string[]
  /** Bloc cité (commentaire de l'équipe) : titre et texte. */
  citation?: { titre: string; texte: string }
  bouton?: { libelle: string; lien: string }
  /** Paragraphes après le bouton. */
  suite: string[]
  /** Afficher l'adresse du lien en clair sous le bouton (invitation). */
  lienEnClair?: string
  /** Lien discret après la suite (désinscription) : phrase d'introduction et adresse, en clair. */
  lienSecondaire?: { intro: string; lien: string }
  /** Alerte interne à l'équipe : pas de ligne Conseil WhatsApp (destinataire = l'équipe). */
  sansConseil?: boolean
}

function assembler(g: Gabarit): Contenu {
  const t = fr.courriels
  const conseil = g.sansConseil ? null : lienWhatsApp(numeroWhatsApp(), messageConseil({ type: 'general' }))
  const texte = [
    g.nom ? t.salutation(g.nom) : t.salutationSansNom,
    ...g.intro,
    ...(g.citation ? [`${g.citation.titre}\n${g.citation.texte}`] : []),
    ...(g.bouton ? [`${g.bouton.libelle} : ${g.bouton.lien}`] : []),
    ...g.suite,
    ...(g.lienSecondaire ? [`${g.lienSecondaire.intro}\n${g.lienSecondaire.lien}`] : []),
    t.signature,
    ...(conseil ? [`${t.conseilWhatsApp} : ${conseil}`] : []),
    t.pied(CONTACT_EQUIPE),
  ].join('\n\n')

  const p = (v: string) => `<p style="margin:0 0 16px">${echapperHtml(v)}</p>`
  const html = [
    '<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Georgia,serif;font-size:16px;line-height:1.5">',
    '<div style="max-width:560px;margin:0 auto">',
    p(g.nom ? t.salutation(g.nom) : t.salutationSansNom),
    ...g.intro.map(p),
    g.citation
      ? `<p style="margin:0 0 4px"><strong>${echapperHtml(g.citation.titre)}</strong></p><blockquote style="margin:0 0 16px;padding:0 0 0 12px;border-left:2px solid #999999;white-space:pre-wrap">${echapperHtml(g.citation.texte)}</blockquote>`
      : '',
    g.bouton
      ? `<p style="margin:24px 0"><a href="${echapperHtml(g.bouton.lien)}" style="display:inline-block;padding:12px 20px;background:#111111;color:#ffffff;text-decoration:none">${echapperHtml(g.bouton.libelle)}</a></p>`
      : '',
    g.lienEnClair
      ? `<p style="margin:0 0 16px;font-size:14px">${echapperHtml(t.invitation.lienAlternatif)}<br><a href="${echapperHtml(g.lienEnClair)}">${echapperHtml(g.lienEnClair)}</a></p>`
      : '',
    ...g.suite.map(p),
    g.lienSecondaire
      ? `<p style="margin:0 0 16px;font-size:14px">${echapperHtml(g.lienSecondaire.intro)}<br><a href="${echapperHtml(g.lienSecondaire.lien)}">${echapperHtml(g.lienSecondaire.lien)}</a></p>`
      : '',
    p(t.signature),
    conseil
      ? `<p style="margin:24px 0 0;font-size:14px"><a href="${echapperHtml(conseil)}">${echapperHtml(t.conseilWhatsApp)}</a></p>`
      : '',
    `<p style="margin:24px 0 0;font-size:14px;color:#555555">${echapperHtml(t.pied(CONTACT_EQUIPE))}</p>`,
    '</div></body></html>',
  ].join('')

  return { sujet: g.sujet, texte, html }
}

export function contenuInvitation(p: { artiste: string; lien: string; echeance: Date }): Contenu {
  const t = fr.courriels.invitation
  const date = formaterDateHeure(p.echeance)
  return assembler({
    sujet: t.sujet,
    nom: p.artiste,
    intro: [t.intro],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.validite(DUREE_INVITATION_JOURS, date), t.neConcernePas],
    lienEnClair: p.lien,
  })
}

export function contenuOeuvreValidee(p: { artiste: string; titre: string; lien: string }): Contenu {
  const t = fr.courriels.validee
  return assembler({
    sujet: t.sujet(p.titre),
    nom: p.artiste,
    intro: [t.intro(p.titre)],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
  })
}

export function contenuOeuvreRenvoyee(p: { artiste: string; titre: string; commentaire: string; lien: string }): Contenu {
  const t = fr.courriels.renvoyee
  return assembler({
    sujet: t.sujet(p.titre),
    nom: p.artiste,
    intro: [t.intro(p.titre)],
    citation: { titre: t.messageEquipe, texte: p.commentaire },
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
  })
}

/** Accusé de réception au visiteur (story 4.2) : le délai annoncé est celui de l'écran de confirmation. */
export function contenuAccuseDemande(): Contenu {
  const t = fr.courriels.accuse
  return assembler({
    sujet: t.sujet,
    intro: [t.intro, t.delai(DELAI_REPONSE_DEMANDE_HEURES)],
    suite: [t.suite],
  })
}

/** Alerte à l'équipe : le numéro de la demande et un lien, aucune donnée personnelle. */
export function contenuAlerteDemande(p: { numero: string; lien: string }): Contenu {
  const t = fr.courriels.alerteDemande
  return assembler({
    sujet: t.sujet,
    intro: [t.intro(p.numero)],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
    sansConseil: true,
  })
}

/**
 * Accusé d'une demande de visite (story 4.3) : titre de l'œuvre, type, créneaux dans le fuseau du
 * visiteur et délai annoncé. Rien sur l'artiste (ni coordonnées), le canal, la durée ni la gratuité.
 */
export function contenuAccuseVisite(p: { titre: string; type: TypeVisite; creneaux: Date[]; fuseau: string }): Contenu {
  const t = fr.courriels.accuseVisite
  return assembler({
    sujet: t.sujet,
    intro: [
      t.intro(p.titre),
      t.type[p.type],
      t.creneaux(p.fuseau),
      ...p.creneaux.map((c) => t.creneau(formaterDateHeure(c, { fuseau: p.fuseau, jourSemaine: true }))),
      t.delai(DELAI_REPONSE_DEMANDE_HEURES),
    ],
    suite: [t.suite],
  })
}

/** Alerte à l'équipe pour une demande de visite : le numéro et un lien, aucune donnée personnelle. */
export function contenuAlerteVisite(p: { numero: string; lien: string }): Contenu {
  const t = fr.courriels.alerteVisite
  return assembler({
    sujet: t.sujet,
    intro: [t.intro(p.numero)],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
    sansConseil: true,
  })
}

/**
 * Annonce de l'ouverture aux contacts de la maintenance (FR-35, story 4.9) : annonce courte, lien vers
 * l'accueil et lien de désinscription. Rien d'inventé : ni date, ni prix, ni nombre d'œuvres.
 */
export function contenuOuverture(p: { lien: string; lienDesinscription: string }): Contenu {
  const t = fr.courriels.ouverture
  return assembler({
    sujet: t.sujet,
    intro: [t.intro],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
    lienSecondaire: { intro: t.desinscription, lien: p.lienDesinscription },
  })
}

/**
 * Confirmation d'une inscription « Me prévenir » (story 4.5, FR-9) : titre de l'œuvre, promesse unique
 * et lien de désinscription. Jamais d'heure de fin de réservation, rien sur l'artiste.
 */
export function contenuConfirmationPrevenir(p: { titre: string; lienDesinscription: string }): Contenu {
  const t = fr.courriels.confirmationPrevenir
  return assembler({
    sujet: t.sujet(p.titre),
    intro: [t.intro(p.titre)],
    suite: [t.suite],
    lienSecondaire: { intro: t.desinscription, lien: p.lienDesinscription },
  })
}

/** E-mail du lien de la commande d'une vente assistée (story 6.3) : échéance en heure fixe, jamais de compte à rebours. */
export function contenuVenteAssistee(p: { nom: string; lien: string; echeance: Date }): Contenu {
  const t = fr.courriels.venteAssistee
  return assembler({
    sujet: t.sujet,
    nom: p.nom,
    intro: [t.intro, t.reserveJusqua(formaterDateHeure(p.echeance))],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.paiement, t.lienPersonnel],
    lienEnClair: p.lien,
  })
}

/** Confirmation à l'acheteur : lignes et totaux figés de la commande, jamais additionnés ici. */
export function contenuCommandeConfirmee(p: {
  nom: string
  numero: string
  lignes: { titre: string; totalCentimes: number; devise: string; delaiMinJours: number; delaiMaxJours: number }[]
  /** Lien de suivi absolu, émis à l'envoi (story 7.7) ; absent : pas de lien. */
  lienSuivi?: string | null
}): Contenu {
  const t = fr.courriels.commande.confirmee
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.nom,
    intro: [
      t.intro(p.numero),
      ...p.lignes.map((l) => `${t.ligne(l.titre, formaterMontant(l.totalCentimes, l.devise))}\n${t.delai(l.delaiMinJours, l.delaiMaxJours)}`),
    ],
    suite: [fr.livraison.droitsNonInclus, t.suite],
    ...(p.lienSuivi ? { lienSecondaire: { intro: fr.courriels.commande.suivi.intro, lien: p.lienSuivi } } : {}),
  })
}

/** Annulation à l'acheteur : aucun débit, ou remboursement demandé ou effectué ; aucun délai promis. */
export function contenuCommandeAnnulee(p: {
  nom: string
  numero: string
  titres: string[]
  remboursement: 'demande' | 'effectue' | null
  /** Un paiement a été constaté (story 8.3) : on ne dit jamais « aucun paiement reçu » dans ce cas. */
  paiementRecu?: boolean
  /** Lien de suivi absolu, émis à l'envoi (story 7.7) ; absent : pas de lien. */
  lienSuivi?: string | null
}): Contenu {
  const t = fr.courriels.commande.annulee
  const etat =
    p.remboursement === 'demande'
      ? t.remboursementDemande(p.numero)
      : p.remboursement === 'effectue'
        ? t.remboursementEffectue(p.numero)
        : p.paiementRecu
          ? t.paiementRecu(p.numero)
          : t.aucunPaiement
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.nom,
    intro: [t.intro(p.numero), ...p.titres.map((titre) => t.ligne(titre)), etat],
    suite: [t.suite],
    ...(p.lienSuivi ? { lienSecondaire: { intro: fr.courriels.commande.suivi.intro, lien: p.lienSuivi } } : {}),
  })
}

/**
 * Annulation par l'équipe d'une commande payée, à l'artiste (story 8.3, décision 3A) : numéro, titres et motif
 * saisi par l'équipe ; jamais de coordonnées de l'acheteur ni de montant.
 */
export function contenuCommandeAnnuleeArtiste(p: { artiste: string; numero: string; titres: string[]; motif: string }): Contenu {
  const t = fr.courriels.commande.annuleeArtiste
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.artiste,
    intro: [t.intro(p.numero), ...p.titres.map((titre) => t.ligne(titre)), t.motif(p.motif)],
    suite: [t.suite],
  })
}

/**
 * Avis à l'artiste : numéro, titres, échéance de prise en charge écrite en heure de Paris et bouton vers sa
 * commande (story 8.1, décision 3A) ; jamais de coordonnées de l'acheteur ni de compte à rebours.
 */
export function contenuCommandeArtiste(p: {
  artiste: string
  numero: string
  titres: string[]
  /** Échéance de prise en charge ; absente (commande d'avant la story 8.1) : la phrase est omise. */
  priseEnChargeAvant?: Date | null
  /** Nom du pays de livraison ; absent : ligne omise. */
  pays?: string | null
  /** Adresse absolue de la commande dans l'espace artiste ; absente : pas de bouton. */
  lien?: string | null
}): Contenu {
  const t = fr.courriels.commande.artiste
  const echeance = p.priseEnChargeAvant ? formaterDateHeure(p.priseEnChargeAvant) : null
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.artiste,
    intro: [t.intro(p.numero), ...p.titres.map((titre) => t.ligne(titre)), ...(p.pays ? [t.pays(p.pays)] : []), ...(echeance && echeance !== DATE_ABSENTE ? [t.echeance(echeance)] : [])],
    ...(p.lien ? { bouton: { libelle: t.bouton, lien: p.lien } } : {}),
    suite: [t.suite],
  })
}

/** Prise en charge par l'artiste (story 8.1) : l'artiste prépare l'œuvre, délai figé rappelé ; aucun montant. */
export function contenuCommandePriseEnCharge(p: {
  nom: string
  numero: string
  artiste: string | null
  lignes: { titre: string; delaiMinJours: number; delaiMaxJours: number }[]
  /** Lien de suivi absolu, émis à l'envoi ; absent : pas de lien. */
  lienSuivi?: string | null
}): Contenu {
  const t = fr.courriels.commande.priseEnCharge
  const artiste = p.artiste && p.artiste.trim() !== '' ? p.artiste.trim() : null
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.nom,
    intro: [
      artiste ? t.intro(p.numero, artiste) : t.introSansArtiste(p.numero),
      ...p.lignes.map((l) => `${t.ligne(l.titre)}${l.delaiMinJours > 0 && l.delaiMaxJours > 0 ? `\n${fr.courriels.commande.confirmee.delai(l.delaiMinJours, l.delaiMaxJours)}` : ''}`),
    ],
    suite: [t.suite],
    ...(p.lienSuivi ? { lienSecondaire: { intro: fr.courriels.commande.suivi.intro, lien: p.lienSuivi } } : {}),
  })
}

/**
 * Expédition par l'artiste (story 8.2) : transporteur et numéro de suivi, lien de suivi du site ; jamais la
 * référence d'assurance, aucun montant.
 */
export function contenuCommandeExpediee(p: {
  nom: string
  numero: string
  artiste: string | null
  titres: string[]
  expedition: { transporteur: string; numeroSuivi: string } | null
  lienSuivi?: string | null
}): Contenu {
  const t = fr.courriels.commande.expedition
  const artiste = p.artiste && p.artiste.trim() !== '' ? p.artiste.trim() : null
  return assembler({
    sujet: t.sujet(p.numero),
    nom: p.nom,
    intro: [
      artiste ? t.intro(p.numero, artiste) : t.introSansArtiste(p.numero),
      ...p.titres.map((titre) => t.ligne(titre)),
      ...(p.expedition ? [t.transporteur(p.expedition.transporteur), t.numeroSuivi(p.expedition.numeroSuivi)] : []),
    ],
    suite: [t.suite],
    ...(p.lienSuivi ? { lienSecondaire: { intro: fr.courriels.commande.suivi.intro, lien: p.lienSuivi } } : {}),
  })
}

/** Alerte à l'équipe pour une commande confirmée ou annulée : numéro et lien, aucune donnée de l'acheteur. */
export function contenuAlerteCommande(p: { numero: string; lien: string; annulee: boolean }): Contenu {
  const t = p.annulee ? fr.courriels.commande.alerteAnnulee : fr.courriels.commande.alerteConfirmee
  return assembler({
    sujet: t.sujet(p.numero),
    intro: [t.intro(p.numero)],
    bouton: { libelle: t.bouton, lien: p.lien },
    suite: [t.suite],
    sansConseil: true,
  })
}
