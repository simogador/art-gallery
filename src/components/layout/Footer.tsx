'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Input } from '@/components/ui'

const NAV_COLUMNS = [
  {
    title: 'Collection',
    links: [
      { href: '#galerie',      label: 'Toutes les œuvres' },
      { href: '#galerie',      label: 'Peintures' },
      { href: '#galerie',      label: 'Sculptures' },
      { href: '#galerie',      label: 'Photographies' },
      { href: '#galerie',      label: 'Art numérique' },
    ],
  },
  {
    title: 'La galerie',
    links: [
      { href: '#artistes',     label: 'Nos artistes' },
      { href: '#expositions',  label: 'Expositions' },
      { href: '#about',        label: 'À propos' },
      { href: '#about',        label: 'Notre histoire' },
      { href: '#about',        label: 'Presse & média' },
    ],
  },
  {
    title: 'Services',
    links: [
      { href: '#contact',      label: 'Conseil en acquisition' },
      { href: '#contact',      label: 'Art sur commande' },
      { href: '#contact',      label: 'Prêt & location' },
      { href: '#contact',      label: 'Estimation d\'œuvres' },
      { href: '#contact',      label: 'Transport & assurance' },
    ],
  },
] as const

const SOCIAL_LINKS = [
  { href: '#', label: 'Instagram', icon: InstagramIcon },
  { href: '#', label: 'LinkedIn',  icon: LinkedInIcon },
  { href: '#', label: 'Pinterest', icon: PinterestIcon },
  { href: '#', label: 'Facebook',  icon: FacebookIcon },
] as const

const LEGAL_LINKS = [
  { href: '#', label: 'Mentions légales' },
  { href: '#', label: 'Politique de confidentialité' },
  { href: '#', label: 'CGV' },
  { href: '#', label: 'Cookies' },
] as const

/* ─── Variants ────────────────────────────────────────────────────────────── */

const columnVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function Footer() {
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <footer className="relative bg-foreground overflow-hidden" role="contentinfo">
      {/* ── Gold separator ── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold to-transparent" />

      {/* ── Main footer content ── */}
      <div className="container-premium pt-16 pb-10 md:pt-20">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 lg:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {/* ── Brand + Newsletter column ── */}
          <motion.div custom={0} variants={columnVariants}>
            {/* Logo */}
            <Link href="/" className="group inline-block mb-6">
              <span className="font-serif text-2xl font-light text-background group-hover:text-gold transition-colors duration-300 block leading-none">
                Galerie
              </span>
              <span className="font-sans text-[9px] uppercase tracking-[0.3em] text-neutral-600 mt-0.5 block">
                D&apos;Art Contemporain
              </span>
            </Link>

            <p className="font-sans text-sm text-neutral-500 leading-relaxed text-pretty mb-8 max-w-xs">
              Une galerie d&apos;exception au cœur de Paris, dédiée à la promotion
              des artistes contemporains les plus singuliers.
            </p>

            {/* Social */}
            <div className="flex items-center gap-3 mb-10">
              {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className={cn(
                    'flex items-center justify-center w-9 h-9',
                    'border border-neutral-800 rounded-sm',
                    'text-neutral-600 hover:text-background hover:border-neutral-600',
                    'transition-all duration-300',
                  )}
                >
                  <Icon />
                </Link>
              ))}
            </div>

            {/* Newsletter */}
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-gold mb-3">
                Lettre de la galerie
              </p>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm font-sans text-neutral-400"
                >
                  <CheckIcon />
                  Inscription confirmée — à bientôt.
                </motion.div>
              ) : (
                <form onSubmit={handleNewsletter} className="flex flex-col gap-2">
                  <Input
                    type="email"
                    placeholder="votre@email.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    variant="underline"
                    className="[&_input]:text-background [&_input]:placeholder:text-neutral-700"
                    aria-label="Adresse email pour la newsletter"
                    required
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    loading={loading}
                    fullWidth
                    className="mt-1"
                  >
                    S&apos;inscrire
                  </Button>
                </form>
              )}
            </div>
          </motion.div>

          {/* ── Nav columns ── */}
          {NAV_COLUMNS.map((col, i) => (
            <motion.div key={col.title} custom={i + 1} variants={columnVariants}>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-600 mb-5">
                {col.title}
              </p>
              <ul className="flex flex-col gap-3">
                {col.links.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="font-sans text-sm text-neutral-500 hover:text-background transition-colors duration-300 hover:translate-x-1 inline-block transition-transform"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Address + Hours ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 pt-8 border-t border-neutral-800"
        >
          <InfoBlock label="Adresse">
            12 Rue de l&apos;Art, 75008 Paris
          </InfoBlock>
          <InfoBlock label="Horaires">
            Mardi — Dimanche · 10h – 19h
          </InfoBlock>
          <InfoBlock label="Contact">
            <a href="mailto:contact@galerie-art.fr"
               className="hover:text-gold transition-colors duration-300">
              contact@galerie-art.fr
            </a>
            {' · '}
            <a href="tel:+33123456789"
               className="hover:text-gold transition-colors duration-300">
              +33 1 23 45 67 89
            </a>
          </InfoBlock>
        </motion.div>

        {/* ── Bottom bar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 pt-6 border-t border-neutral-800">
          <p className="font-sans text-xs text-neutral-700">
            © {new Date().getFullYear()} Galerie d&apos;Art Contemporain. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6">
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="font-sans text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-500 transition-colors duration-300"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Decorative background ── */}
      <FooterDecor />
    </footer>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 mb-1.5">{label}</p>
      <p className="font-sans text-sm text-neutral-400">{children}</p>
    </div>
  )
}

function FooterDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full border border-neutral-800 opacity-40" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-neutral-800 opacity-30" />
      <div className="absolute bottom-1/3 right-1/4 w-2 h-2 rounded-full bg-gold opacity-40" />
      <div className="absolute top-1/4 left-1/3 w-1 h-1 rounded-full bg-gold opacity-25" />
    </div>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function PinterestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l3.5 3.5L13 4" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
