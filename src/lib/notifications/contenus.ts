import { fr, formaterDateHeure } from '@/lib/i18n'
import { CONTACT_EQUIPE, DELAI_REPONSE_DEMANDE_HEURES, DUREE_INVITATION_JOURS } from '@/lib/reglages'

// Contenus des e-mails transactionnels (story 4.1) : textes du dictionnaire `fr`, vouvoiement. Pur
// (aucun accès à la base). Chaque e-mail se termine par l'adresse de l'équipe ; le lien Conseil
// WhatsApp s'y ajoutera avec la story 4.4.

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
}

function assembler(g: Gabarit): Contenu {
  const t = fr.courriels
  const texte = [
    g.nom ? t.salutation(g.nom) : t.salutationSansNom,
    ...g.intro,
    ...(g.citation ? [`${g.citation.titre}\n${g.citation.texte}`] : []),
    ...(g.bouton ? [`${g.bouton.libelle} : ${g.bouton.lien}`] : []),
    ...g.suite,
    t.signature,
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
    p(t.signature),
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
  })
}
