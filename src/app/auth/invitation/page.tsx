import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { CHARTE_ARTISTE, lireInvitation } from '@/lib/acces'
import { COOKIE_INVITATION } from './cookie'
import { FormulaireActivation } from './FormulaireActivation'
import { LienExpire } from './LienExpire'

// Activation d'une invitation (story 2.4) : le jeton arrive par le cookie httpOnly posé par
// /auth/invitation/[jeton], jamais par l'URL.

export const metadata: Metadata = { title: 'Créer mon accès — Errancy', referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function InvitationPage() {
  const jeton = cookies().get(COOKIE_INVITATION)?.value
  const invitation = jeton ? await lireInvitation(jeton) : null

  return (
    <main className="min-h-full flex justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-xl">
        <Link href="/" className="font-serif text-2xl text-foreground">
          Errancy
        </Link>
        <div className="mt-10">
          {invitation ? (
            <>
              <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Espace artiste</p>
              <h1 className="font-serif font-light text-foreground text-3xl mb-2">Créer mon accès</h1>
              <p className="font-sans text-sm text-neutral-600 mb-8">
                Bienvenue, {invitation.artiste}. Choisissez votre mot de passe et lisez la charte artiste.
              </p>
              <FormulaireActivation email={invitation.email} charte={CHARTE_ARTISTE} />
            </>
          ) : (
            <LienExpire />
          )}
        </div>
      </div>
    </main>
  )
}
