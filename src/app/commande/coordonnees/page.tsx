import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { COOKIE_COMMANDE } from '@/app/commande/cookie'
import { lirePassagePublic, lireRecapitulatifAssiste, type PassagePublic, type Recapitulatif } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { lot2Ouvert } from '@/lib/reglages'
import { COOKIE_PASSAGE } from './cookie'
import { CoordonneesAssistee } from './CoordonneesAssistee'
import { CoordonneesPanier } from './CoordonneesPanier'
import { FocusSiMarque } from './FocusSiMarque'
import { ModifierCommande } from './ModifierCommande'
import { RecapitulatifFige } from './RecapitulatifFige'
import { ReservationHeureFixe } from './ReservationHeureFixe'

// Coordonnées sans compte et réservation en heure fixe (story 7.3, FR-10, FR-12, UX-DR37). Trois états,
// relus en base à chaque requête (cookies `commande` et `passage`, pays du cookie `pays`) :
// - un passage posé par l'équipe (cookie `commande`, décision 3A) : sa réservation est reprise, l'acheteur
//   complète adresse et téléphone (indépendant du Lot 2) ;
// - un passage de l'acheteur sans compte (cookie `passage`) : son échéance en heure fixe, « Continuer »
//   retente la réservation si elle est échue ;
// - sinon le panier (slugs du navigateur) et le formulaire, seulement si le Lot 2 est ouvert (AD-17).
// Ordre : passage de l'équipe, puis lien de l'équipe devenu inactif (cookie `commande` sans passage valide :
// « Ce lien n'est plus actif »), puis Lot 2 fermé (qui masque aussi le passage de l'acheteur), puis le
// passage de l'acheteur, puis le panier.
// Aucun jeton dans l'adresse ; ni e-mail ni adresse dans les journaux. Hors mesure.

export const metadata: Metadata = { title: fr.coordonnees.titreDocument, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const t = fr.coordonnees

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 pt-28">
      <div className="container-premium max-w-4xl">
        <nav aria-label={t.filAriane} className="mb-8 font-sans text-xs uppercase tracking-widest text-neutral-600">
          <Link href="/panier" className="inline-flex min-h-touch-target items-center hover:text-foreground">
            {t.panier}
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

export default async function CoordonneesPage() {
  const jar = cookies()
  const pays = lirePays(jar.get(COOKIE_PAYS)?.value)
  const ouvert = lot2Ouvert()

  let assiste: Recapitulatif | null = null
  let passage: PassagePublic | null = null
  let panne = false
  let liensInactifs = false
  try {
    const jetonAssiste = jar.get(COOKIE_COMMANDE)?.value
    if (jetonAssiste) assiste = await lireRecapitulatifAssiste(jetonAssiste)
    const jetonPassage = jar.get(COOKIE_PASSAGE)?.value
    if (!assiste && jetonPassage) passage = await lirePassagePublic(jetonPassage)
    liensInactifs = Boolean(jetonAssiste) && !assiste
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

  // Passage posé par l'équipe : la vente assistée ne dépend pas du Lot 2.
  if (assiste) {
    return (
      <Cadre>
        <p className="font-sans text-sm text-neutral-600">{t.assistee.introduction}</p>
        <div className="mt-6">
          <ReservationHeureFixe echeance={assiste.echeance.toISOString()} echue={false} consommerMarque={false} />
        </div>
        <RecapitulatifFige recapitulatif={assiste} />
        <div className="mt-10">
          {assiste.adresseRenseignee ? (
            <FocusSiMarque>
              <p role="status" className="font-sans text-sm text-foreground">{t.enregistrees}</p>
            </FocusSiMarque>
          ) : (
            <>
              <h2 className="mb-6 font-serif text-heading-md text-foreground">{t.assistee.titre}</h2>
              <CoordonneesAssistee />
            </>
          )}
          <p className="mt-8">
            <Link href="/commande" className="inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
              {t.assistee.retour}
            </Link>
          </p>
        </div>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  // Lien de l'équipe échu ou libéré, sans passage de l'acheteur en cours.
  if (liensInactifs && !passage) {
    return (
      <Cadre>
        <h2 className="font-serif text-heading-md text-foreground">{t.inactif.titre}</h2>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.inactif.texte}</p>
        <p className="mt-6 flex flex-wrap gap-6">
          <Link href="/commande" className="inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
            {t.inactif.commande}
          </Link>
          <Link href="/panier" className="inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
            {t.inactif.panier}
          </Link>
        </p>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  // Lot 2 fermé : aucun passage public, ni formulaire (AD-17).
  if (!ouvert) {
    return (
      <Cadre>
        <h2 className="font-serif text-heading-md text-foreground">{t.ferme.titre}</h2>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.ferme.texte}</p>
        <Link href="/panier" className="mt-6 inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
          {t.ferme.retour}
        </Link>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  if (passage) {
    const titres = Object.fromEntries(passage.commandes.flatMap((c) => c.lignes.map((l) => [l.slug, l.titre])))
    return (
      <Cadre>
        <ReservationHeureFixe echeance={passage.echeance.toISOString()} echue={passage.echue} reprise={{ titres }}>
          {!passage.echue && (
            <Link href="/commande/paiement" className="mt-4 inline-flex min-h-touch-target items-center rounded-sm border border-foreground bg-foreground px-8 py-3 font-sans text-sm font-medium text-background">
              {t.continuerPaiement}
            </Link>
          )}
        </ReservationHeureFixe>
        <RecapitulatifFige recapitulatif={passage} />
        <p role="status" className="mt-8 font-sans text-sm text-foreground">{t.enregistrees}</p>
        <div className="mt-8">
          <ModifierCommande />
        </div>
        <BoutonConseil className="mt-8" />
      </Cadre>
    )
  }

  return (
    <Cadre>
      <CoordonneesPanier pays={{ code: pays, nom: nomPays(pays) }} conseil={<BoutonConseil contexte={{ type: 'general' }} />} />
    </Cadre>
  )
}
