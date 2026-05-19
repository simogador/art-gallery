'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { loginWithCredentials, loginWithGoogle } from '../actions'

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function LoginForm() {
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [googlePending, startGoogle] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginWithCredentials(formData)
      if (result?.error) setError(result.error)
    })
  }

  function handleGoogle() {
    startGoogle(async () => { await loginWithGoogle() })
  }

  return (
    <div className="min-h-screen grid md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_480px]">

      {/* ── Left — Form ── */}
      <div className="flex flex-col justify-center px-8 py-16 md:px-16 lg:px-24">
        <motion.div
          className="w-full max-w-sm mx-auto"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="visible"
        >
          {/* Back link */}
          <motion.div custom={0} variants={fadeUp}>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-300 mb-10"
            >
              <ArrowLeftIcon />
              Errancy
            </Link>
          </motion.div>

          {/* Heading */}
          <motion.div custom={1} variants={fadeUp} className="mb-8">
            <div className="divider mb-6" />
            <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}>
              Bon retour
            </h1>
            <p className="font-sans text-sm text-neutral-500 mt-2 text-pretty">
              Connectez-vous à votre espace collection.
            </p>
          </motion.div>

          {/* Google OAuth */}
          <motion.div custom={2} variants={fadeUp} className="mb-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googlePending || isPending}
              className={cn(
                'w-full flex items-center justify-center gap-3',
                'border border-neutral-200 rounded-sm py-3 px-4',
                'font-sans text-sm text-foreground',
                'hover:border-neutral-400 hover:bg-neutral-50',
                'transition-all duration-300',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {googlePending ? <Spinner /> : <GoogleIcon />}
              <span>Continuer avec Google</span>
            </button>
          </motion.div>

          {/* Separator */}
          <motion.div custom={3} variants={fadeUp} className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="font-sans text-xs text-neutral-400 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-sm"
            >
              <p className="font-sans text-xs text-red-600">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <motion.form custom={4} variants={fadeUp} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email" name="email" type="email" placeholder="vous@exemple.fr" required autoComplete="email" />
            <Field label="Mot de passe" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />

            <div className="flex items-center justify-end">
              <Link href="/auth/mot-de-passe" className="font-sans text-xs text-neutral-400 hover:text-gold transition-colors duration-300">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isPending || googlePending}
              className={cn(
                'w-full py-3.5 mt-2',
                'bg-foreground text-background',
                'font-sans text-xs uppercase tracking-widest',
                'rounded-sm border border-foreground',
                'hover:bg-neutral-800 transition-colors duration-300',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {isPending ? <><Spinner /><span>Connexion…</span></> : 'Se connecter'}
            </button>
          </motion.form>

          {/* Register link */}
          <motion.p custom={5} variants={fadeUp} className="mt-8 font-sans text-sm text-neutral-500 text-center">
            Pas encore de compte ?{' '}
            <Link href="/auth/inscription" className="text-foreground underline underline-offset-4 hover:text-gold transition-colors duration-300">
              Créer un compte
            </Link>
          </motion.p>
        </motion.div>
      </div>

      {/* ── Right — Decorative panel ── */}
      <DecorativePanel
        title="Bienvenue"
        subtitle="Accédez à votre collection personnelle, suivez vos artistes favoris et découvrez les expositions en avant-première."
      />
    </div>
  )
}

/* ─── Decorative Panel ────────────────────────────────────────────────────── */

function DecorativePanel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="hidden md:flex flex-col justify-between bg-foreground px-12 py-16 relative overflow-hidden"
    >
      {/* Grid lines decoration */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {[25, 50, 75].map((pos) => (
          <div key={pos} className="absolute top-0 bottom-0 w-px bg-neutral-800" style={{ left: `${pos}%` }} />
        ))}
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" style={{ top: '40%' }} />
      </div>

      {/* Top — Logo */}
      <div className="relative z-10">
        <p className="font-sans text-[9px] uppercase tracking-[0.35em] text-neutral-600 mb-1">Galerie</p>
        <p className="font-serif text-3xl font-light text-background tracking-tight">Errancy</p>
      </div>

      {/* Center — Quote */}
      <div className="relative z-10">
        <div className="w-12 h-px bg-gold mb-8" />
        <p className="font-serif font-light text-background text-balance leading-relaxed" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
          {title}
        </p>
        <p className="font-sans text-sm text-neutral-500 mt-4 text-pretty leading-relaxed max-w-xs">
          {subtitle}
        </p>
      </div>

      {/* Bottom — Stats */}
      <div className="relative z-10 flex items-center gap-8 pt-8 border-t border-neutral-800">
        {[
          { value: '5',  label: 'Artistes' },
          { value: '8',  label: 'Œuvres' },
          { value: '3',  label: 'Expositions' },
        ].map(({ value, label }) => (
          <div key={label}>
            <p className="font-serif text-2xl font-light text-background leading-none">{value}</p>
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Field ───────────────────────────────────────────────────────────────── */

function Field({ label, name, type = 'text', placeholder, required, autoComplete }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean; autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={cn(
          'px-4 py-3 rounded-sm',
          'border border-neutral-200 bg-transparent',
          'font-sans text-sm text-foreground',
          'placeholder:text-neutral-300',
          'outline-none focus:border-foreground',
          'transition-colors duration-300',
        )}
      />
    </div>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}
