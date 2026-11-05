import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAF8',
        foreground: '#0A0A0A',
        gold: {
          DEFAULT: '#C9A84C',
          light: '#D4B96A',
          dark: '#A8872E',
          muted: '#C9A84C1A',
        },
        neutral: {
          50:  '#FAFAF8',
          100: '#F5F5F2',
          200: '#E8E8E4',
          300: '#D4D4CF',
          400: '#A8A8A2',
          500: '#6B6B65',
          600: '#4A4A45',
          700: '#2D2D2A',
          800: '#1A1A18',
          900: '#0A0A0A',
        },
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans:  ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      // Échelle de DESIGN.md (story 3.1) : titres en Cormorant 600, Inter pour le reste.
      fontSize: {
        'display-2xl': ['4.5rem',   { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-xl':  ['3.75rem',  { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg':  ['3rem',     { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-md':  ['2.25rem',  { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm':  ['1.875rem', { lineHeight: '1.25', fontWeight: '600' }],
        'display-xs':  ['1.5rem',   { lineHeight: '1.3',  fontWeight: '600' }],
        'heading-sm':  ['1.25rem',  { lineHeight: '1.2',  fontWeight: '600' }],
        'body-strong': ['0.875rem', { lineHeight: '1.3',  fontWeight: '600' }],
        'price-lg':    ['1.25rem',  { lineHeight: '1.2',  fontWeight: '600' }],
        'label-caps':  ['0.75rem',  { lineHeight: '1.4',  letterSpacing: '0.06em', fontWeight: '500' }],
        'caption':     ['0.75rem',  { lineHeight: '1.4',  fontWeight: '400' }],
        'button':      ['0.875rem', { lineHeight: '1.2',  fontWeight: '500' }],
        'input':       ['1rem',     { lineHeight: '1.4',  fontWeight: '400' }],
      },
      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '2px',
        md:   '4px',
        lg:   '6px',
        full: '9999px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        // Story 3.1 : cible tactile minimale (44 px) et marge latérale mobile.
        'touch-target':  '2.75rem',
        'gutter-mobile': '1rem',
      },
      transitionDuration: {
        '350': '350ms',
        '450': '450ms',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      // Story 3.1 (UX-DR6) : seuls fade-in et scale-in (plus slide-up de la feuille de
      // confirmation, story 2.8), coupés sous prefers-reduced-motion (globals.css).
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'scale-in': 'scale-in 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'slide-up': 'slide-up 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      },
      boxShadow: {
        'premium-sm': '0 1px 3px 0 rgba(10,10,10,0.08), 0 1px 2px -1px rgba(10,10,10,0.04)',
        'premium':    '0 4px 16px -2px rgba(10,10,10,0.10), 0 2px 6px -2px rgba(10,10,10,0.06)',
        'premium-lg': '0 16px 48px -4px rgba(10,10,10,0.14), 0 6px 16px -4px rgba(10,10,10,0.08)',
        'gold':       '0 0 0 1px rgba(201,168,76,0.4), 0 4px 16px -2px rgba(201,168,76,0.2)',
      },
    },
  },
  plugins: [typography],
}

export default config
