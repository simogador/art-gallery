import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { COOKIE_PASSAGE } from '@/app/commande/coordonnees/cookie'
import { lireConfirmationPassage } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { lot2Ouvert } from '@/lib/reglages'
import { CartClearer } from './CartClearer'
import { CartesConfirmation } from './CartesConfirmation'
import { MiseAJourAuto } from './MiseAJourAuto'
import { SuivreCommandes } from './SuivreCommandes'

// Confirmation de commande (story 7.6, FR-13, UJ-1) pour le passage de l'acheteur sans compte (cookie `passage`,
// décision 1A). Relue en base à chaque requête : aucun prestataire n'est interrogé (l'ancien `?session_id=` du
// flux Stripe est ignoré) et rien n'est écrit. « Confirmée » seulement pour une commande `confirmee` ; en
// attente du constat : message d'attente et mise à jour automatique ; annulée : dite telle, sans promesse.
// Lot 2 fermé ou aucun passage : message neutre. Hors mesure, `noindex`. Ni e-mail ni adresse dans les journaux.

export const metadata: Metadata = { title: fr.confirmation.titreDocument, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const t = fr.confirmation
const ID_TITRE = 'titre-confirmation'
const LONGUEUR_NOM_MAX = 60

function Cadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 pt-28">
      <div className="container-premium max-w-4xl">
        <span className="mb-4 block font-sans text-xs uppercase tracking-[0.25em] text-neutral-600">{t.surtitre}</span>
        <h1 id={ID_TITRE} tabIndex={-1} className="break-words font-serif text-display-md font-light text-foreground">
          {titre}
        </h1>
        <div className="divider mt-4" />
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}

function Neutre({ titre, texte, lien }: { titre: string; texte: string; lien: string }) {
  return (
    <Cadre titre={titre}>
      <p className="font-sans text-sm text-neutral-600">{texte}</p>
      <Link href="/" className="mt-6 inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
        {lien}
      </Link>
      <BoutonConseil className="mt-8" />
    </Cadre>
  )
}

export default async function ConfirmationPage() {
  // Lot 2 fermé : aucun passage public, rien n'est lu (AD-17).
  if (!lot2Ouvert()) return <Neutre titre={t.ferme.titre} texte={t.ferme.texte} lien={t.ferme.accueil} />

  const confirmation = await lireConfirmationPassage(cookies().get(COOKIE_PASSAGE)?.value)
  if (!confirmation) return <Neutre titre={t.inactif.titre} texte={t.inactif.texte} lien={t.inactif.accueil} />

  const { commandes, etat, nom, reservationEchue } = confirmation
  const enAttente = commandes.some((c) => c.etat === 'en_attente_paiement')
  const confirmees = commandes.filter((c) => c.etat === 'confirmee')
  const annulee = commandes.some((c) => c.etat === 'annulee')
  // Le rafraîchissement ne tourne que pour un passage en attente dont la réservation court.
  const rafraichit = enAttente && !reservationEchue
  const confirmee = confirmees.length > 0
  const nomCourt = nom.trim().length > LONGUEUR_NOM_MAX ? `${nom.trim().slice(0, LONGUEUR_NOM_MAX)}…` : nom.trim()
  // « Merci » seulement quand plus aucune commande n'attend ; sinon le titre dit que ce n'est pas encore confirmé.
  const titre = enAttente
    ? t.titreAttente
    : confirmee
      ? nomCourt === ''
        ? t.merciSansNom
        : t.merci(nomCourt)
      : etat === 'annulee'
        ? t.etats.annulee
        : t.titreAttente

  return (
    <Cadre titre={titre}>
      {confirmee && <CartClearer slugs={confirmees.flatMap((c) => c.lignes.map((l) => l.slug))} />}
      {rafraichit && <p className="font-sans text-sm text-foreground">{t.attente}</p>}
      <MiseAJourAuto enAttente={rafraichit} confirmee={confirmee && !enAttente} annulee={annulee && !enAttente} idTitre={ID_TITRE} />
      {enAttente && reservationEchue && (
        <div className="mb-8">
          <p className="font-sans text-sm text-foreground">{t.echue.texte}</p>
          <Link href="/commande/coordonnees" className="mt-4 inline-flex min-h-touch-target items-center font-sans text-sm underline underline-offset-4">
            {t.echue.retenter}
          </Link>
        </div>
      )}
      {annulee && <p className="mb-8 font-sans text-sm text-foreground">{t.annulee}</p>}
      <CartesConfirmation commandes={commandes} />
      {confirmee && <SuivreCommandes />}
      <BoutonConseil className="mt-8" />
    </Cadre>
  )
}
