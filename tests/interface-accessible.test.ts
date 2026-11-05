import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import config from '../tailwind.config'
import { cn } from '@/lib/utils/cn'

// Story 3.1 (UX-DR1 à UX-DR6, NFR-3) : interface lisible et accessible. Scan de src/, sans base.
// - Couleurs : jamais d'or pour du texte, jamais neutral-400/300 pour du texte, neutral-200
//   seulement sur fond noir (même classe que le fond) ;
// - Directions : propriétés logiques seulement (start/end, ms/me, ps/pe, border-s/e) ;
// - Socle global : lien d'évitement vers #contenu, focus noir 2 px, mouvement réduit, lang="fr".

const RACINE = fileURLToPath(new URL('..', import.meta.url))
// Liste supprimée = aucune exception (toutes les pages refaites).
const CHEMIN_EXCEPTIONS = path.join(RACINE, 'tests/exceptions-interface.cjs')
const EXCEPTIONS: string[] = existsSync(CHEMIN_EXCEPTIONS) ? createRequire(import.meta.url)(CHEMIN_EXCEPTIONS) : []

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'generated' ? [] : fichiers(chemin)
    return /\.(ts|tsx|css)$/.test(nom) ? [chemin] : []
  })

const relatif = (chemin: string) => path.relative(RACINE, chemin).split(path.sep).join('/')
const SOURCES = fichiers(path.join(RACINE, 'src')).map(relatif)
const lire = (fichier: string) => readFileSync(path.join(RACINE, fichier), 'utf8')
// Commentaires retirés en gardant les retours à la ligne (numéros de ligne exacts).
const sansCommentaires = (texte: string) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')).replace(/^\s*\/\/.*$/gm, '')

const exempte = (fichier: string) => EXCEPTIONS.includes(fichier)

// Début d'une classe : début de ligne, espace, guillemet, accent grave, deux-points (variante)
// ou « ! » (modificateur important).
const DEBUT = String.raw`(?<=^|[\s"'\x60:!])`
// Fond noir non conditionnel (pas de variante hover:, md:… devant).
const FOND_SOMBRE = /(?<![\w:-])!?bg-(?:foreground|black|neutral-(?:700|800|900))(?![\w/-])/
const NEUTRAL_200 = /(?<![\w-])text-neutral-200(?![\w])/
const CHAINES = /"[^"\n]*"|'[^'\n]*'|`[^`]*`/g

type Regle = { nom: string; motif: RegExp } | { nom: string; trouve: (ligne: string) => boolean }

const REGLES: Regle[] = [
  { nom: 'texte or (text-gold*)', motif: /(?<![\w-])text-gold(?![\w])/ },
  { nom: 'texte or (.gold-text)', motif: /(?<![\w-])gold-text(?![\w-])/ },
  { nom: 'texte neutral-400 ou neutral-300', motif: /(?<![\w-])text-neutral-(?:300|400)(?![\w])/ },
  {
    // Permis seulement dans la même chaîne de classes qu'un fond noir.
    nom: 'texte neutral-200 hors fond noir',
    trouve: (ligne) => {
      if (!NEUTRAL_200.test(ligne)) return false
      const chaines = ligne.match(CHAINES) ?? []
      const hors = ligne.replace(CHAINES, '')
      return NEUTRAL_200.test(hors) || chaines.some((c) => NEUTRAL_200.test(c) && !FOND_SOMBRE.test(c))
    },
  },
  {
    nom: 'direction physique (left/right, ml/mr, pl/pr)',
    motif: new RegExp(`${DEBUT}-?(?:left|right|ml|mr|pl|pr)-(?=[\\w\\[/.])`),
  },
  { nom: 'alignement physique (text-left/right)', motif: /(?<![\w-])text-(?:left|right)(?![\w-])/ },
  { nom: 'bordure physique (border-l/r)', motif: /(?<![\w-])border-[lr](?![\w])/ },
  { nom: 'coin physique (rounded-l/r/tl/tr/bl/br)', motif: /(?<![\w-])rounded-(?:l|r|tl|tr|bl|br)(?![\w])/ },
  { nom: 'flottant physique (float-left/right)', motif: /(?<![\w-])float-(?:left|right)(?![\w-])/ },
  { nom: 'origine physique (origin-…left/right)', motif: /(?<![\w-])origin-(?:(?:top|bottom)-)?(?:left|right)(?![\w-])/ },
  { nom: 'défilement physique (scroll-ml/mr/pl/pr)', motif: /(?<![\w-])scroll-(?:ml|mr|pl|pr)-/ },
]

const STYLE_PHYSIQUE = /(?<![\w-])(left|right|marginLeft|marginRight|paddingLeft|paddingRight)\s*:/

/** Classes et styles interdits d'un fichier, une entrée « fichier:ligne : règle » par occurrence. */
function classesInterdites(fichier: string, texte: string): string[] {
  const trouves: string[] = []
  const propre = sansCommentaires(texte)
  propre.split('\n').forEach((ligne, i) => {
    for (const regle of REGLES) {
      const touche = 'motif' in regle ? regle.motif.test(ligne) : regle.trouve(ligne)
      if (touche) trouves.push(`${fichier}:${i + 1} : ${regle.nom} — ${ligne.trim().slice(0, 120)}`)
    }
  })
  // Styles en ligne : clés physiques dans style={{ … }}, même sur plusieurs lignes.
  for (const m of propre.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    const cle = STYLE_PHYSIQUE.exec(m[1])
    if (cle) {
      const ligne = propre.slice(0, m.index! + 8 + cle.index).split('\n').length
      trouves.push(`${fichier}:${ligne} : style physique (${cle[1]}) — ${m[0].slice(0, 120).replace(/\s+/g, ' ')}`)
    }
  }
  return trouves
}

/** Animations en boucle : ping interdit, pulse/bounce seulement sous `motion-safe:`. */
function animationsEnBoucle(fichier: string, texte: string): string[] {
  return [...sansCommentaires(texte).matchAll(/((?:[\w\[\]&:-]*?:)?)!?animate-(ping|pulse|bounce)(?![\w-])/g)]
    .filter((m) => m[2] === 'ping' || m[1] !== 'motion-safe:')
    .map((m) => `${fichier}: ${m[0]}`)
}

describe('interface lisible et accessible (story 3.1)', () => {
  it('aucune classe interdite dans src/, hors pages exemptées', () => {
    const trouves = SOURCES.filter((f) => !exempte(f)).flatMap((f) => classesInterdites(f, lire(f)))
    expect(trouves).toEqual([])
  })

  it('une classe interdite ajoutée fait échouer le scan en nommant le fichier', () => {
    const exemples = [
      'className="text-gold"',
      'className="hover:text-gold-dark"',
      'className="gold-text"',
      'className="text-neutral-400"',
      "'placeholder:text-neutral-300'",
      'className="text-neutral-200"',
      'className="absolute left-0"',
      'className="-right-4"',
      'className="md:pl-10"',
      'className="mr-2"',
      'className="text-right"',
      'className="border-l-2"',
      'className="border-r"',
      'className="!left-0"',
      'className="md:!pr-4"',
      'className="hover:bg-foreground text-neutral-200"',
      'className="md:bg-foreground text-neutral-200"',
      'cn(\'bg-foreground\', \'text-neutral-200\')',
      'className="rounded-l-sm"',
      'className="rounded-tr"',
      'className="float-left"',
      'className="origin-right"',
      'className="origin-top-left"',
      'className="scroll-pl-4"',
      'style={{ left: `${pos}%` }}',
      'style={{ marginRight: 8 }}',
      'style={{ top: 0, paddingLeft: 4 }}',
    ]
    for (const exemple of exemples) {
      expect(classesInterdites('src/app/exemple.tsx', exemple), exemple).toEqual([
        expect.stringContaining('src/app/exemple.tsx:1'),
      ])
    }
    const permis = [
      'className="bg-foreground text-neutral-200"',
      'className="absolute start-0 end-4 ms-2 pe-10 text-start border-s-2 border-e"',
      'className="border-gold bg-gold text-neutral-600 text-neutral-500"',
      'className="inset-x-0 border-x"',
      'className="!bg-foreground text-neutral-200"',
      'className="rounded-t-sm rounded-s float-start origin-center scroll-ps-4"',
      'style={{ insetInlineStart: `${pos}%`, top: 0 }}',
    ]
    for (const exemple of permis) expect(classesInterdites('src/app/exemple.tsx', exemple), exemple).toEqual([])
    // Style physique sur plusieurs lignes : signalé à la ligne de la clé.
    expect(classesInterdites('src/app/exemple.tsx', 'a\n<div style={{\n  top: 0,\n  right: 4,\n}} />')).toEqual([
      expect.stringContaining('src/app/exemple.tsx:4 : style physique (right)'),
    ])
  })

  it('animations en boucle : ping interdit, pulse et bounce seulement sous motion-safe:', () => {
    for (const exemple of ['animate-ping', 'motion-safe:animate-ping', 'animate-pulse', 'md:animate-pulse', 'motion-reduce:animate-bounce', '!animate-bounce']) {
      expect(animationsEnBoucle('src/app/exemple.tsx', `className="${exemple}"`), exemple).toEqual([
        expect.stringContaining('src/app/exemple.tsx'),
      ])
    }
    for (const exemple of ['motion-safe:animate-pulse', 'motion-safe:animate-bounce', 'animate-spin', 'animate-fade-in']) {
      expect(animationsEnBoucle('src/app/exemple.tsx', `className="${exemple}"`), exemple).toEqual([])
    }
    expect(SOURCES.flatMap((f) => animationsEnBoucle(f, lire(f)))).toEqual([])
  })

  it('la liste d’exceptions ne nomme que des fichiers existants qui en ont encore besoin', () => {
    for (const e of EXCEPTIONS) {
      expect(existsSync(path.join(RACINE, e)) && statSync(path.join(RACINE, e)).isFile(), e).toBe(true)
      expect(classesInterdites(e, lire(e)).length, `${e} passe le scan : retirez-le de la liste`).toBeGreaterThan(0)
    }
  })

  it('lien d’évitement, élément principal #contenu et lang="fr" dans le layout racine', () => {
    const layout = lire('src/app/layout.tsx')
    expect(layout).toMatch(/<html lang="fr"/)
    expect(layout).toMatch(/<a\s+href="#contenu"[\s\S]*?>\s*Aller au contenu\s*<\/a>/)
    expect(layout).toMatch(/<main id="contenu"/)
    // Le lien d'évitement est le premier élément du body, avant l'en-tête.
    expect(layout.indexOf('href="#contenu"')).toBeLessThan(layout.indexOf('<Header'))
    // Un seul <main> : celui du layout (pas de <main> imbriqué dans les pages).
    const mains = SOURCES.filter((f) => f.endsWith('.tsx') && /<main[\s>]/.test(sansCommentaires(lire(f))))
    expect(mains).toEqual(['src/app/layout.tsx'])
  })

  it('focus visible : contour noir 2 px, décalage 2 px, jamais or', () => {
    const css = sansCommentaires(lire('src/styles/globals.css'))
    const focus = /(?:^|\n)\s*:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(focus).toMatch(/outline:\s*2px solid theme\('colors\.foreground'\)/)
    expect(focus).toMatch(/outline-offset:\s*2px/)
    const orAuFocus = SOURCES.flatMap((f) =>
      [...sansCommentaires(lire(f)).matchAll(/(?:(?:focus[\w-]*:)[\w-]*gold[\w/-]*|outline-gold|ring-gold)/g)].map((m) => `${f}: ${m[0]}`),
    )
    expect(orAuFocus).toEqual([])
    expect(css).not.toMatch(/:focus[^{]*\{[^}]*gold/)
  })

  it('mouvement réduit : framer-motion et CSS coupés, ni parallaxe ni animation infinie', () => {
    const layout = lire('src/app/layout.tsx')
    expect(layout).toMatch(/<MouvementReduit>/)
    expect(lire('src/components/layout/MouvementReduit.tsx')).toMatch(/<MotionConfig reducedMotion="user">/)
    const css = sansCommentaires(lire('src/styles/globals.css'))
    const reduit = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? ''
    expect(reduit).toMatch(/animation-duration:\s*0\.01ms !important/)
    expect(reduit).toMatch(/transition-duration:\s*0\.01ms !important/)
    expect(reduit).toMatch(/animation-delay:\s*0s !important/)
    expect(reduit).toMatch(/transition-delay:\s*0s !important/)
    expect(reduit).toMatch(/animation-iteration-count:\s*1 !important/)
    expect(reduit).toMatch(/scroll-behavior:\s*auto !important/)
    expect(css).not.toMatch(/scroll-smooth/)
    const mouvements = SOURCES.flatMap((f) => {
      const texte = sansCommentaires(lire(f))
      return [/repeat:\s*Infinity/, /useTransform\(/]
        .filter((m) => m.test(texte))
        .map((m) => `${f}: ${m}`)
    })
    expect(mouvements).toEqual([])
  })

  it('cn garde les tailles de texte de DESIGN.md à côté d’une couleur de texte', () => {
    expect(cn('text-input text-foreground')).toBe('text-input text-foreground')
    expect(cn('text-button text-background', 'text-caption')).toBe('text-background text-caption')
    expect(cn('text-heading-sm text-neutral-600 text-display-sm')).toBe('text-neutral-600 text-display-sm')
  })

  it('tailwind.config.ts : palette et polices inchangées, jetons de DESIGN.md, deux animations', () => {
    const theme = config.theme!.extend!
    expect(theme.colors).toEqual({
      background: '#FAFAF8',
      foreground: '#0A0A0A',
      gold: { DEFAULT: '#C9A84C', light: '#D4B96A', dark: '#A8872E', muted: '#C9A84C1A' },
      neutral: {
        50: '#FAFAF8', 100: '#F5F5F2', 200: '#E8E8E4', 300: '#D4D4CF', 400: '#A8A8A2',
        500: '#6B6B65', 600: '#4A4A45', 700: '#2D2D2A', 800: '#1A1A18', 900: '#0A0A0A',
      },
    })
    expect(theme.fontFamily).toEqual({
      serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
      sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
    })
    const tailles = theme.fontSize as Record<string, [string, Record<string, string>]>
    expect(tailles['heading-sm']).toEqual(['1.25rem', { lineHeight: '1.2', fontWeight: '600' }])
    expect(tailles['body-strong']).toEqual(['0.875rem', { lineHeight: '1.3', fontWeight: '600' }])
    expect(tailles['price-lg']).toEqual(['1.25rem', { lineHeight: '1.2', fontWeight: '600' }])
    expect(tailles['label-caps']).toEqual(['0.75rem', { lineHeight: '1.4', letterSpacing: '0.06em', fontWeight: '500' }])
    expect(tailles['caption']).toEqual(['0.75rem', { lineHeight: '1.4', fontWeight: '400' }])
    expect(tailles['button']).toEqual(['0.875rem', { lineHeight: '1.2', fontWeight: '500' }])
    expect(tailles['input']).toEqual(['1rem', { lineHeight: '1.4', fontWeight: '400' }])
    for (const t of ['display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-sm', 'display-xs']) {
      expect(tailles[t][1].fontWeight, t).toBe('600')
    }
    const espaces = theme.spacing as Record<string, string>
    expect(espaces['touch-target']).toBe('2.75rem')
    expect(espaces['gutter-mobile']).toBe('1rem')
    expect(Object.keys(theme.animation as object).sort()).toEqual(['fade-in', 'scale-in', 'slide-up'])
    expect((theme.animation as Record<string, string>)['fade-in']).toMatch(/^fade-in 400ms /)
    expect((theme.animation as Record<string, string>)['scale-in']).toMatch(/^scale-in 450ms /)
    // fade-in : opacité seule, aucun déplacement.
    expect(JSON.stringify((theme.keyframes as Record<string, unknown>)['fade-in'])).not.toMatch(/transform/)
  })
})
