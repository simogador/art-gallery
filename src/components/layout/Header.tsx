'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui'

const NAV_LINKS = [
  { href: '/#galerie',    label: 'Galerie' },
  { href: '/artistes',    label: 'Artistes' },
  { href: '/expositions',  label: 'Expositions' },
  { href: '/#about',      label: 'À propos' },
] as const

const menuVariants = {
  closed: { opacity: 0, x: '100%', transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  open:   { opacity: 1, x: '0%',   transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const navItemVariants = {
  closed: { opacity: 0, x: 20 },
  open: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.1 + i * 0.07, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function Header() {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [activeLink, setActiveLink] = useState('')
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 40)
  })

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden'
    else          document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <motion.header
        className={cn(
          'fixed top-0 left-0 right-0 z-40',
          'transition-all duration-500',
          scrolled
            ? 'bg-background/90 backdrop-blur-md border-b border-neutral-200/70 shadow-premium-sm'
            : 'bg-transparent',
        )}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="container-premium">
          <div className="flex items-center justify-between h-16 md:h-20">

            {/* Logo */}
            <Link
              href="/"
              className="group flex flex-col leading-none"
              onClick={closeMenu}
            >
              <span className="font-serif text-xl md:text-2xl font-light tracking-tight text-foreground transition-colors duration-300 group-hover:text-gold">
                Galerie
              </span>
              <span className="font-sans text-[9px] uppercase tracking-[0.3em] text-neutral-500 mt-0.5">
                D&apos;Art Contemporain
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
              {NAV_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  active={activeLink === href}
                  onClick={() => setActiveLink(href)}
                />
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" size="sm">
                Connexion
              </Button>
              <Button variant="gold" size="sm">
                Contacter
              </Button>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                'md:hidden flex flex-col justify-center items-center gap-1.5',
                'w-10 h-10 rounded-sm',
                'transition-colors duration-200',
                'focus-visible:outline focus-visible:outline-gold',
              )}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              <motion.span
                className="block w-5 h-px bg-foreground origin-center"
                animate={menuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block w-5 h-px bg-foreground origin-center"
                animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block w-5 h-px bg-foreground origin-center"
                animate={menuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closeMenu}
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              className={cn(
                'fixed top-0 right-0 bottom-0 z-40',
                'w-[280px] bg-background border-l border-neutral-200',
                'flex flex-col pt-20 pb-10 px-8',
                'md:hidden',
              )}
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
            >
              {/* Gold accent */}
              <div className="divider mb-8" />

              <nav className="flex flex-col gap-6" aria-label="Navigation mobile">
                {NAV_LINKS.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    custom={i}
                    variants={navItemVariants}
                    initial="closed"
                    animate="open"
                  >
                    <Link
                      href={href}
                      onClick={closeMenu}
                      className={cn(
                        'font-serif text-2xl font-light',
                        'text-foreground hover:text-gold',
                        'transition-colors duration-300',
                        'block',
                      )}
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3">
                <Button variant="ghost" size="md" fullWidth onClick={closeMenu}>
                  Connexion
                </Button>
                <Button variant="gold" size="md" fullWidth onClick={closeMenu}>
                  Contacter
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─── NavLink ─────────────────────────────────────────────────────────────── */

interface NavLinkProps {
  href:     string
  label:    string
  active:   boolean
  onClick?: () => void
}

function NavLink({ href, label, active, onClick }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative group',
        'font-sans text-sm font-medium uppercase tracking-widest',
        'transition-colors duration-300',
        active ? 'text-foreground' : 'text-neutral-500 hover:text-foreground',
      )}
    >
      {label}
      <motion.span
        className="absolute -bottom-0.5 left-0 h-px bg-gold"
        initial={false}
        animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
        whileHover={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ originX: 0, width: '100%' }}
      />
    </Link>
  )
}
