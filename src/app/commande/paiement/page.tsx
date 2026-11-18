import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { COOKIE_COMMANDE } from '@/app/commande/cookie'
import { COOKIE_PASSAGE } from '@/app/commande/coordonnees/cookie'
import { ReservationHeureFixe } from '@/app/commande/coordonnees/ReservationHeureFixe'
import { lireRecapitulatifPaiement, type RecapitulatifPaiement } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { lot2Ouvert } from '@/lib/reglages'
import { CartesPaiement } from './CartesPaiement'
import { ZoneNeutre } from './ZoneNeutre'

// Récapitulatif et paiement (story 7.4, FR-11, FR-14, AD-4) pour le passage de l'acheteur sans compte
// (cookie `passage`, décision 2A : la vente assistée garde `/commande`). Relu en base à chaque requête.
// Lot 2 fermé, passage inconnu, périmé, payé, annulé ou abandonné : message neutre, rien n'est créé. Réservation
// échue : « a pris fin » et renvoi vers les coordonnées. Sinon : récapitulatif (lignes figées et agrégats),
// réservation en heure fixe, rappel sobre des conditions (décision 1A, sans lien avant la story 7.1) et zone de
// paiement : neutre tant qu'aucun adaptateur d'encaissement n'est configuré (OQ-1). La page ne fait que lire :
// aucune écriture dans un rendu GET (la story 7.5 ouvrira le paiement par une action serveur déclenchée par
// l'acheteur, `ouvrirPaiement` de `commandes`). Hors mesure, `noindex`. Ni e-mail ni adresse dans les journaux.

export const metadata: Metadata = { title: fr.paiementAcheteur.titreDocument, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const t = fr.paiementAcheteur

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 pt-28">
      <div className="container-premium max-w-4xl">
        <nav aria-label={t.filAriane} className="mb-8 font-sans text-xs uppercase tracking-widest text-neutral-600">
          <Link href="/commande/coordonnees" className="inline-flex min-h-touch-target items-center hover:text-foreground">
            {t.retourCoordonnees}
          </Link>
        </nav>
        <span className="mb-4 block font-sans text-xs uppercase tracking-[0.25em] text-neutral-600">{t.surtitre}</span>
        <h1 className="font-serif text-display-md font-light text-foreground">{t.titre}</h1>
        <div className="divider mt-4" />
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}

function Lien({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-6 inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
      {children}
    </Link>
  )
}

export default async function PaiementPage() {
  // Lot 2 fermé : aucun passage public, rien n'est lu (AD-17).
  if (!lot2Ouvert()) {
    return (
      <Cadre>
        <h2 className="font-serif text-heading-md text-foreground">{t.ferme.titre}</h2>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.ferme.texte}</p>
        <Lien href="/panier">{t.ferme.retour}</Lien>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  const jar = cookies()
  const jeton = jar.get(COOKIE_PASSAGE)?.value
  const passageEquipe = Boolean(jar.get(COOKIE_COMMANDE)?.value)
  let recapitulatif: RecapitulatifPaiement | null = null
  let panne = false
  try {
    recapitulatif = await lireRecapitulatifPaiement(jeton)
  } catch {
    panne = true
  }

  if (panne) {
    return (
      <Cadre>
        <p role="alert" className="font-sans text-sm text-foreground">{t.panne}</p>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  if (!recapitulatif) {
    return (
      <Cadre>
        <h2 className="font-serif text-heading-md text-foreground">{t.inactif.titre}</h2>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.inactif.texte}</p>
        <Lien href="/panier">{t.inactif.retour}</Lien>
        {passageEquipe && <Lien href="/commande">{t.inactif.commande}</Lien>}
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  // Un seul arbre pour les deux états : `ReservationHeureFixe` garde son instance quand la réponse du serveur
  // passe à « échue » (annonce `role="status"` et focus sur la phrase).
  const { echue } = recapitulatif
  return (
    <Cadre>
      <ReservationHeureFixe echeance={recapitulatif.echeance.toISOString()} echue={echue} consommerMarque={false} />
      {echue ? (
        <>
          <p className="mt-3 font-sans text-sm text-neutral-600">{t.echue.texte}</p>
          <Lien href="/commande/coordonnees">{t.echue.retenter}</Lien>
          <BoutonConseil className="mt-8" />
        </>
      ) : (
        <>
          <CartesPaiement recapitulatif={recapitulatif} />
          <section aria-labelledby="conditions-titre" className="mt-8">
            <h2 id="conditions-titre" className="font-serif text-heading-sm text-foreground">
              {t.conditions.titre}
            </h2>
            <p className="mt-2 font-sans text-sm text-neutral-600">{t.conditions.texte}</p>
          </section>
          <ZoneNeutre numeros={recapitulatif.commandes.map((c) => c.numero)} conseil={<BoutonConseil contexte={{ type: 'general' }} />} />
        </>
      )}
    </Cadre>
  )
}
