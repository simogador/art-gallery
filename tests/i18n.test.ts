import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  cookieUnite,
  formaterDate,
  formaterDateHeure,
  formaterDimensions,
  formaterDimensionsDouble,
  formaterHeure,
  formaterMontant,
  fr,
  lireUnite,
  SEPARATEUR,
} from '@/lib/i18n'
import { formatPrice } from '@/lib/utils/artworks'
import { formaterDimensions as formaterDimensionsCatalogue, lireDimensions } from '@/lib/catalogue/conversions'
import { heureLisible } from '@/lib/disponibilite/etats'
import { DimensionsChoisies, UniteProvider, UniteToggle } from '@/components/ui/UniteToggle'
import { ArtworkDetail } from '@/app/galerie/[id]/ArtworkDetail'
import type { Artwork } from '@/lib/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({}), usePathname: () => '/' }))

// Story 3.2 (AR-11, AD-18, FR-17, UX-DR21) : textes, montants et unités au même format partout.
// Fonctions pures et scans de src/, sans base.

const F = ' ' // espace fine insécable
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const exiger = createRequire(import.meta.url)

describe('formaterMontant', () => {
  it('« 1 450 € » avec espaces fines insécables, centimes seulement s’ils existent', () => {
    expect(formaterMontant(145000)).toBe(`1${F}450${F}€`)
    expect(formaterMontant(145050)).toBe(`1${F}450,50${F}€`)
    expect(formaterMontant(145005)).toBe(`1${F}450,05${F}€`)
    expect(formaterMontant(0)).toBe(`0${F}€`)
    expect(formaterMontant(99)).toBe(`0,99${F}€`)
    expect(formaterMontant(123456789)).toBe(`1${F}234${F}567,89${F}€`)
    expect(formaterMontant(-2500)).toBe(`-25${F}€`)
  })

  it('montant absent : « — »', () => {
    expect(formaterMontant(null)).toBe('—')
    expect(formaterMontant(undefined)).toBe('—')
  })

  it('devise : code en minuscules accepté (Stripe : « eur »), autre devise affichée par son code', () => {
    expect(formaterMontant(145000, 'eur')).toBe(`1${F}450${F}€`)
    expect(formaterMontant(1000, 'USD')).toBe(`10${F}USD`)
    expect(formaterMontant(1000, 'usd')).toBe(`10${F}USD`)
  })

  it('formatPrice (euros du type d’affichage) délègue', () => {
    expect(formatPrice(1450)).toBe(`1${F}450${F}€`)
    expect(formatPrice(1250.5)).toBe(`1${F}250,50${F}€`)
  })
})

describe('formaterDimensions', () => {
  const d = { hauteurMm: 610, largeurMm: 760, profondeurMm: null }

  it('centimètres : « 61 × 76 cm », une décimale au plus', () => {
    expect(formaterDimensions(d, 'cm')).toBe(`61${F}×${F}76${F}cm`)
    expect(formaterDimensions(d)).toBe(`61${F}×${F}76${F}cm`)
    expect(formaterDimensions({ hauteurMm: 2946, largeurMm: 2321, profondeurMm: 280 }, 'cm')).toBe(
      `294,6${F}×${F}232,1${F}×${F}28${F}cm`,
    )
  })

  it('pouces : « 24 × 29,9 in », une décimale', () => {
    expect(formaterDimensions(d, 'in')).toBe(`24${F}×${F}29,9${F}in`)
    expect(formaterDimensions({ hauteurMm: 600, largeurMm: 800, profondeurMm: 40 }, 'in')).toBe(
      `23,6${F}×${F}31,5${F}×${F}1,6${F}in`,
    )
  })

  it('hauteur ou largeur absente : chaîne vide', () => {
    expect(formaterDimensions({ hauteurMm: null, largeurMm: 760, profondeurMm: null }, 'cm')).toBe('')
    expect(formaterDimensions({ hauteurMm: 610, largeurMm: null, profondeurMm: 30 }, 'in')).toBe('')
    expect(formaterDimensions(null)).toBe('')
    expect(formaterDimensionsDouble({ hauteurMm: null, largeurMm: 760, profondeurMm: null }, 'in')).toBeNull()
  })

  it('fiche : unité choisie, puis l’autre', () => {
    expect(formaterDimensionsDouble(d, 'in')).toEqual([`24${F}×${F}29,9${F}in`, `61${F}×${F}76${F}cm`])
    expect(formaterDimensionsDouble(d, 'cm')).toEqual([`61${F}×${F}76${F}cm`, `24${F}×${F}29,9${F}in`])
  })

  it('catalogue/conversions délègue et le texte se relit à l’identique', () => {
    expect(formaterDimensionsCatalogue(d)).toBe(formaterDimensions(d, 'cm'))
    expect(lireDimensions(formaterDimensionsCatalogue({ hauteurMm: 2946, largeurMm: 2321, profondeurMm: 280 }))).toEqual({
      hauteurMm: 2946,
      largeurMm: 2321,
      profondeurMm: 280,
    })
  })
})

describe('dates et heures', () => {
  it('« 15 h 42 », 24 h, heure de Paris par défaut', () => {
    expect(formaterHeure(new Date('2026-11-05T14:42:00Z'))).toBe('15 h 42')
    expect(formaterHeure(new Date('2026-07-04T07:05:00Z'))).toBe('9 h 05')
    expect(formaterHeure(new Date('2026-07-04T22:30:00Z'))).toBe('0 h 30')
    expect(heureLisible(new Date('2026-11-05T14:42:00Z'))).toBe('15 h 42')
  })

  it('fuseau paramétrable', () => {
    expect(formaterHeure(new Date('2026-11-05T14:42:00Z'), 'America/New_York')).toBe('9 h 42')
    expect(formaterDate(new Date('2026-11-04T23:30:00Z'))).toBe('5 novembre 2026')
    expect(formaterDate(new Date('2026-11-04T23:30:00Z'), { fuseau: 'UTC' })).toBe('4 novembre 2026')
  })

  it('date invalide, texte illisible ou fuseau inconnu : « — », jamais d’exception', () => {
    for (const illisible of [new Date('x'), 'pas une date', '', null, undefined]) {
      expect(formaterDate(illisible)).toBe('—')
      expect(formaterHeure(illisible)).toBe('—')
      expect(formaterDateHeure(illisible)).toBe('—')
    }
    const le = new Date('2026-11-05T14:42:00Z')
    expect(formaterDate(le, { fuseau: 'Pas/UnFuseau' })).toBe('—')
    expect(formaterHeure(le, 'Pas/UnFuseau')).toBe('—')
    expect(formaterDateHeure(le, { fuseau: 'Pas/UnFuseau' })).toBe('—')
  })

  it('date longue, courte, sans année ; date et heure', () => {
    const le = new Date('2026-11-05T14:42:00Z')
    expect(formaterDate(le)).toBe('5 novembre 2026')
    expect(formaterDate(le, { mois: 'court' })).toBe('5 nov. 2026')
    expect(formaterDate(le, { annee: false })).toBe('5 novembre')
    expect(formaterDateHeure(le)).toBe('5 novembre 2026 à 15 h 42')
    expect(formaterDateHeure(le.toISOString(), { annee: false })).toBe('5 novembre à 15 h 42')
  })
})

describe('unité choisie (cookie unite)', () => {
  it('cookie absent ou invalide : cm', () => {
    expect(lireUnite(undefined)).toBe('cm')
    expect(lireUnite('')).toBe('cm')
    expect(lireUnite('mm')).toBe('cm')
    expect(lireUnite('IN')).toBe('cm')
    expect(lireUnite('in')).toBe('in')
    expect(lireUnite('cm')).toBe('cm')
  })

  it('cookie d’un an, sur tout le site', () => {
    expect(cookieUnite('in')).toBe('unite=in; Path=/; Max-Age=31536000; SameSite=Lax')
  })

  it('le layout racine lit le cookie et fournit l’unité à tout le site', () => {
    const layout = readFileSync(path.join(RACINE, 'src/app/layout.tsx'), 'utf8')
    expect(layout).toMatch(/lireUnite\(cookies\(\)\.get\(COOKIE_UNITE\)\?\.value\)/)
    expect(layout).toMatch(/<UniteProvider initiale=\{unite\}>/)
  })

  it('dictionnaire : libellés de la bascule, aucun sélecteur de langue ni de devise', () => {
    expect(fr.unite.cm).toBe('cm')
    expect(fr.unite.in).toBe('in')
    expect(JSON.stringify(fr)).not.toMatch(/langue|devise/i)
  })

  it('séparateur « · » partagé, insécable avant', () => {
    expect(SEPARATEUR).toBe('\u00a0· ')
    expect(fr.commun.separateur).toBe(SEPARATEUR)
  })
})

describe('rendu de l’unité choisie', () => {
  const mm = { hauteurMm: 610, largeurMm: 760, profondeurMm: null }

  it('bascule et dimensions en pouces sous UniteProvider initiale="in"', () => {
    const html = renderToStaticMarkup(
      h(UniteProvider, { initiale: 'in', children: [h(UniteToggle, { key: 'b' }), h('p', { key: 'p' }, h(DimensionsChoisies, { mm }))] }),
    )
    expect(html).toContain(`<p>24${F}×${F}29,9${F}in</p>`)
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="pouces"/)
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="centimètres"/)
    expect(html).toMatch(/aria-pressed="true"[^>]*class="[^"]*fond-sombre/)
  })

  it('sans fournisseur : centimètres ; double : unité choisie, puis l’autre et le complément', () => {
    expect(renderToStaticMarkup(h(DimensionsChoisies, { mm }))).toBe(`61${F}×${F}76${F}cm`)
    expect(renderToStaticMarkup(h(UniteProvider, { initiale: 'in', children: h(DimensionsChoisies, { mm, double: true, complement: 'paysage' }) }))).toBe(
      `24${F}×${F}29,9${F}in (61${F}×${F}76${F}cm${SEPARATEUR}paysage)`,
    )
    expect(renderToStaticMarkup(h(DimensionsChoisies, { mm: { hauteurMm: null, largeurMm: 1 }, vide: '—' }))).toBe('—')
  })

  it('fiche œuvre : les deux unités, pouces d’abord, bascule liée au libellé visible', () => {
    const oeuvre: Artwork = {
      id: 'x', title: 'T', artist: 'A', artistId: 'a', year: 2024, medium: 'Peinture', technique: 'Huile',
      price: 1450, ...mm, description: 'd', tags: [], featured: false, sold: false, imageUrl: null,
      gradient: '', accentColor: '#000',
    }
    const html = renderToStaticMarkup(
      h(UniteProvider, { initiale: 'in', children: h(ArtworkDetail, { artwork: oeuvre, related: [], artist: null, pays: { code: 'FR', nom: 'France' } }) }),
    )
    const pouces = html.indexOf(`24${F}×${F}29,9${F}in`)
    const cm = html.indexOf(`61${F}×${F}76${F}cm`)
    expect(pouces).toBeGreaterThan(0)
    expect(cm).toBeGreaterThan(pouces)
    expect(html).toContain('id="libelle-unite"')
    expect(html).toContain('aria-labelledby="libelle-unite"')
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="pouces"/)
  })
})

/* ── Scans ──────────────────────────────────────────────────────────────── */

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'generated' ? [] : fichiers(chemin)
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
const relatif = (chemin: string) => path.relative(RACINE, chemin).split(path.sep).join('/')

describe('mises en forme centralisées', () => {
  it('ni toLocaleString ni Intl.DateTimeFormat/NumberFormat hors de src/lib/i18n (sauf Intl.DisplayNames)', () => {
    const trouves = fichiers(path.join(RACINE, 'src'))
      .map(relatif)
      .filter((f) => !f.startsWith('src/lib/i18n/'))
      .flatMap((f) =>
        readFileSync(path.join(RACINE, f), 'utf8')
          .split('\n')
          .flatMap((ligne, i) =>
            /toLocale(?:Date|Time)?String|Intl\.(?!DisplayNames)\w+/.test(ligne) ? [`${f}:${i + 1}`] : [],
          ),
      )
    expect(trouves).toEqual([])
  })
})

describe('textes en dur (react/jsx-no-literals)', () => {
  const EXCEPTIONS: string[] = exiger(path.join(RACINE, 'eslint/exceptions-textes.cjs'))
  const config = exiger(path.join(RACINE, '.eslintrc.js'))
  const regle = config.overrides.find((o: { rules?: Record<string, unknown> }) => o.rules?.['react/jsx-no-literals'])
  // eslint n'a pas de types déclarés dans le projet : chargé par require.
  const { ESLint } = exiger('eslint')
  const eslint = new ESLint({ cwd: RACINE })
  // Règle forcée sur les fichiers exemptés, pour vérifier qu'ils en ont encore besoin.
  const eslintForce = new ESLint({
    cwd: RACINE,
    ignore: false,
    overrideConfig: { rules: { 'react/jsx-no-literals': regle.rules['react/jsx-no-literals'] } },
  })
  type Resultat = { messages: { ruleId: string | null; severity: number }[] }
  const erreursTextes = (r: Resultat[]) =>
    r.flatMap((x) => x.messages).filter((m) => m.ruleId === 'react/jsx-no-literals' && m.severity === 2)

  it('une chaîne visible en dur dans l’en-tête ou le pied de page est une erreur', async () => {
    for (const fichier of ['src/components/layout/Header.tsx', 'src/components/layout/Footer.tsx']) {
      const source = 'export function X() {\n  return <p>Galerie</p>\n}\n'
      expect(erreursTextes(await eslint.lintText(source, { filePath: path.join(RACINE, fichier) })), fichier).toHaveLength(1)
      const dictionnaire = "import { fr } from '@/lib/i18n'\nexport function X() {\n  return <p>{fr.commun.marque}</p>\n}\n"
      expect(erreursTextes(await eslint.lintText(dictionnaire, { filePath: path.join(RACINE, fichier) })), fichier).toEqual([])
    }
  }, 60_000)

  it('la liste d’exceptions ne nomme que des fichiers existants qui en ont encore besoin', async () => {
    for (const fichier of EXCEPTIONS) {
      const resultats = await eslintForce.lintFiles([path.join(RACINE, fichier)])
      expect(erreursTextes(resultats).length, `${fichier} passe la règle : retirez-le de la liste`).toBeGreaterThan(0)
    }
  }, 120_000)
})
