import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  boutonConseil,
  etatConseil,
  lienWhatsApp,
  messageConseil,
  normaliserNumero,
  sousLigneConseil,
} from '@/lib/conseil'
import { CONSEIL_HORAIRES, DELAI_CONSEIL_HEURES, DELAI_REPONSE_DEMANDE_HEURES, numeroWhatsApp } from '@/lib/reglages'

// Story 4.4 (FR-7, UX-DR14, OQ-7) : Conseil WhatsApp contextualisé, avec repli. Le vrai numéro n'est
// jamais écrit ici : ce numéro est factice (indicatif et chiffres inventés).
const NUMERO = ['3', '3', '7', '0', '0', '0', '0', '0', '0', '0', '0'].join('')
const NUMERO_SAISI = `+${NUMERO.slice(0, 2)} ${NUMERO.slice(2, 3)} ${NUMERO.slice(3)}`

// Instants en UTC ; Londres = UTC en hiver, UTC+1 en été (heure d'été).
const mardi10hHiver = new Date('2026-11-10T10:00:00Z')
const mardi20hHiver = new Date('2026-11-10T20:00:00Z')
const vendredi19hHiver = new Date('2026-11-13T19:00:00Z')
const samedi = new Date('2026-11-14T11:00:00Z')
const dimanche = new Date('2026-11-15T11:00:00Z')

afterEach(() => vi.unstubAllEnvs())

describe('réglages', () => {
  it('lundi au vendredi, 9 h à 18 h, Londres, moins de 2 heures (décision du porteur)', () => {
    expect(CONSEIL_HORAIRES).toEqual({ fuseau: 'Europe/London', jours: [1, 2, 3, 4, 5], debut: 9, fin: 18 })
    expect(DELAI_CONSEIL_HEURES).toBe(2)
  })
  it('numéro : lu seulement dans WHATSAPP_NUMERO, jamais de valeur par défaut', () => {
    expect(numeroWhatsApp({})).toBeNull()
    expect(numeroWhatsApp({ WHATSAPP_NUMERO: '   ' })).toBeNull()
    expect(numeroWhatsApp({ WHATSAPP_NUMERO: ` ${NUMERO_SAISI} ` })).toBe(NUMERO_SAISI)
  })
})

describe('numéro et lien wa.me', () => {
  it('normalise la saisie en chiffres, refuse l’invalide', () => {
    expect(normaliserNumero(NUMERO_SAISI)).toBe(NUMERO)
    expect(normaliserNumero(`00${NUMERO}`)).toBe(NUMERO)
    expect(normaliserNumero(NUMERO)).toBe(NUMERO)
    for (const mauvais of [null, undefined, '', 'abc', '12', '+0123456789', '1234567890123456', `${NUMERO}x`, 'https://wa.me/1']) {
      expect(normaliserNumero(mauvais)).toBeNull()
    }
  })
  it('encode le texte : « & », accents, espaces ; lien valide', () => {
    const message = 'Bonjour & merci : « Nuit étoilée » (réf. a b)'
    const lien = lienWhatsApp(NUMERO, message)!
    const url = new URL(lien)
    expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMERO}`)
    expect(url.searchParams.get('text')).toBe(message)
    expect(lien).not.toMatch(/\s/)
    expect(lienWhatsApp('abc', message)).toBeNull()
  })
})

describe('message prérempli', () => {
  it('fiche : référence (slug) et lien absolu de l’œuvre', () => {
    const m = messageConseil({ type: 'oeuvre', slug: 'nuit-etoilee', titre: 'Nuit étoilée' })
    expect(m).toContain('Nuit étoilée')
    expect(m).toContain('nuit-etoilee')
    expect(m).toContain('https://www.errancy.art/galerie/nuit-etoilee')
  })
  it('page artiste : nom de l’artiste ; ailleurs ou titre/nom absent : message général', () => {
    expect(messageConseil({ type: 'artiste', nom: 'Karim Benali' })).toContain('Karim Benali')
    const general = messageConseil({ type: 'general' })
    expect(messageConseil({ type: 'oeuvre', slug: 'x', titre: ' ' })).toBe(general)
    expect(messageConseil({ type: 'artiste', nom: '' })).toBe(general)
  })
})

describe('horaires', () => {
  it('dans les horaires : mardi 10 h', () => {
    expect(etatConseil(mardi10hHiver)).toEqual({ ouvert: true })
  })
  it('hors horaires : demain (lundi au jeudi soir), lundi (vendredi soir, week-end)', () => {
    expect(etatConseil(mardi20hHiver)).toEqual({ ouvert: false, prochaine: 'demain' })
    expect(etatConseil(vendredi19hHiver)).toEqual({ ouvert: false, prochaine: 'lundi' })
    expect(etatConseil(samedi)).toEqual({ ouvert: false, prochaine: 'lundi' })
    expect(etatConseil(dimanche)).toEqual({ ouvert: false, prochaine: 'lundi' })
    expect(etatConseil(new Date('2026-11-10T07:30:00Z'))).toEqual({ ouvert: false, prochaine: 'aujourdhui' })
  })
  it('bornes : 9 h inclus, 18 h exclu (heure de Londres)', () => {
    expect(etatConseil(new Date('2026-11-10T09:00:00Z')).ouvert).toBe(true)
    expect(etatConseil(new Date('2026-11-10T17:59:00Z')).ouvert).toBe(true)
    expect(etatConseil(new Date('2026-11-10T18:00:00Z')).ouvert).toBe(false)
  })
  it('heure d’été : 9 h à Londres = 8 h UTC', () => {
    expect(etatConseil(new Date('2026-07-14T07:59:00Z')).ouvert).toBe(false)
    expect(etatConseil(new Date('2026-07-14T08:00:00Z')).ouvert).toBe(true)
    expect(etatConseil(new Date('2026-07-14T16:59:00Z')).ouvert).toBe(true)
    expect(etatConseil(new Date('2026-07-14T17:00:00Z')).ouvert).toBe(false)
  })
  it('le jour est celui de Londres, pas de l’UTC', () => {
    // Samedi 00 h 30 à Londres (été) = vendredi 23 h 30 UTC : c’est déjà le week-end.
    expect(etatConseil(new Date('2026-07-17T23:30:00Z'))).toEqual({ ouvert: false, prochaine: 'lundi' })
  })
  it('sous-ligne : délai et horaires avec le fuseau nommé, sans « GMT » ; sinon prochaine ouverture', () => {
    const ouvert = sousLigneConseil({ ouvert: true })
    expect(ouvert).toContain('Réponse en moins de 2 heures')
    expect(ouvert).toContain('lundi au vendredi, 9 h–18 h')
    expect(ouvert).toContain('heure de Londres')
    expect(ouvert).not.toMatch(/GMT/)
    expect(sousLigneConseil({ ouvert: false, prochaine: 'demain' })).toBe('Réponse demain à partir de 9 h')
    expect(sousLigneConseil({ ouvert: false, prochaine: 'lundi' })).toBe('Réponse lundi à partir de 9 h')
  })
})

describe('bouton : WhatsApp ou repli', () => {
  const contexte = { type: 'oeuvre', slug: 'nuit', titre: 'Nuit' } as const
  it('numéro valide : lien wa.me, horaires', () => {
    const b = boutonConseil({ numero: NUMERO_SAISI, contexte, maintenant: mardi10hHiver })
    expect(b.mode).toBe('whatsapp')
    expect(b.href.startsWith(`https://wa.me/${NUMERO}?text=`)).toBe(true)
    expect(b.sousLigne).toContain('moins de 2 heures')
  })
  it('numéro absent ou invalide : /conseil et 48 heures, jamais le délai de WhatsApp', () => {
    for (const numero of [null, '', 'abc']) {
      const b = boutonConseil({ numero, contexte, maintenant: mardi10hHiver })
      expect(b).toEqual({ mode: 'repli', href: '/conseil', sousLigne: `Réponse sous ${DELAI_REPONSE_DEMANDE_HEURES} heures` })
      expect(b.sousLigne).not.toContain('2 heures')
    }
  })
})

describe('composant BoutonConseil (rendu serveur)', () => {
  async function rendre(contexte: Parameters<typeof boutonConseil>[0]['contexte'], surSombre = false) {
    const { BoutonConseil } = await import('@/components/ui/BoutonConseil')
    return renderToStaticMarkup(createElement(BoutonConseil, { contexte, surSombre }))
  }

  it('numéro réglé : nommé par son action, le numéro n’apparaît que dans le lien', async () => {
    vi.stubEnv('WHATSAPP_NUMERO', NUMERO_SAISI)
    const html = await rendre({ type: 'oeuvre', slug: 'nuit', titre: 'Nuit & jour' })
    expect(html).toContain('aria-label="Conseil WhatsApp sur Nuit &amp; jour')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain(`href="https://wa.me/${NUMERO}?text=`)
    const sansLiens = html.replace(/href="[^"]*"/g, '')
    expect(sansLiens).not.toContain(NUMERO)
    expect(sansLiens).not.toContain(NUMERO_SAISI)
    expect(html).not.toMatch(/green|#25d366|emerald/i)
  })

  it('numéro absent : même emplacement, ouvre /conseil, 48 heures, aucune erreur', async () => {
    vi.stubEnv('WHATSAPP_NUMERO', '')
    const html = await rendre({ type: 'general' })
    expect(html).toContain('href="/conseil"')
    expect(html).not.toContain('target=')
    expect(html).toContain('Réponse sous 48 heures')
  })
})

describe('pied des e-mails', () => {
  async function tous() {
    const c = await import('@/lib/notifications/contenus')
    const lien = 'https://www.errancy.art/x'
    const artiste = { artiste: 'Karim Benali', lien }
    return {
      visiteur: {
        invitation: c.contenuInvitation({ ...artiste, echeance: new Date('2026-11-17T10:00:00Z') }),
        validee: c.contenuOeuvreValidee({ ...artiste, titre: 'Nuit' }),
        renvoyee: c.contenuOeuvreRenvoyee({ ...artiste, titre: 'Nuit', commentaire: 'Photo floue.' }),
        accuseDemande: c.contenuAccuseDemande(),
        accuseVisite: c.contenuAccuseVisite({ titre: 'Nuit', type: 'distance', creneaux: [new Date('2027-01-12T10:00:00Z'), new Date('2027-01-13T10:00:00Z')], fuseau: 'Europe/Paris' }),
      },
      equipe: {
        alerteDemande: c.contenuAlerteDemande({ numero: '12', lien }),
        alerteVisite: c.contenuAlerteVisite({ numero: '13', lien }),
      },
    }
  }
  const PIED = 'Une question ? Écrivez-nous à contact@errancy.art'

  it('numéro réglé : lien WhatsApp avant le pied sur tous les e-mails sauf les deux alertes de l’équipe', async () => {
    vi.stubEnv('WHATSAPP_NUMERO', NUMERO_SAISI)
    const { visiteur, equipe } = await tous()
    for (const c of Object.values(visiteur)) {
      expect(c.texte).toContain(`https://wa.me/${NUMERO}?text=`)
      expect(c.html).toContain(`href="https://wa.me/${NUMERO}?text=`)
      expect(c.texte.indexOf('wa.me')).toBeLessThan(c.texte.indexOf('Une question ?'))
      expect(c.texte.trimEnd().endsWith(PIED)).toBe(true)
    }
    for (const c of Object.values(equipe)) {
      expect(c.texte + c.html).not.toMatch(/wa\.me|WhatsApp/)
      expect(c.texte.trimEnd().endsWith(PIED)).toBe(true)
    }
  })

  it('numéro absent : aucun texte WhatsApp, corps identique à celui des alertes de l’équipe avec numéro', async () => {
    vi.stubEnv('WHATSAPP_NUMERO', NUMERO_SAISI)
    const avec = await tous()
    vi.stubEnv('WHATSAPP_NUMERO', '')
    const sans = await tous()
    for (const c of [...Object.values(sans.visiteur), ...Object.values(sans.equipe)]) {
      expect(c.texte + c.html).not.toMatch(/wa\.me|WhatsApp/)
      expect(c.texte.trimEnd().endsWith(PIED)).toBe(true)
    }
    expect(sans.equipe).toEqual(avec.equipe)
    for (const [nom, c] of Object.entries(sans.visiteur)) {
      const v = avec.visiteur[nom as keyof typeof avec.visiteur]
      expect(c.texte).not.toBe(v.texte)
      expect(c.sujet).toBe(v.sujet)
    }
  })
})
