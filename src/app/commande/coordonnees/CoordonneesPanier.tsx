'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PaysLivraison } from '@/components/ui/PaysLivraison'
import { CarteCommande, LigneIndisponibleVue, TotalGeneral } from '@/app/panier/CartesPanier'
import { recalculerPanier } from '@/app/panier/actions'
import { useCartStore } from '@/lib/store/cart'
import { fr } from '@/lib/i18n'
import { PLAFONDS_RESERVATION } from '@/lib/reglages'
import type { PanierCompose } from '@/lib/panier'
import { envoyerCoordonnees, type ReponseCoordonnees } from './actions'
import { FormulaireCoordonnees } from './FormulaireCoordonnees'

// Coordonnées d'un acheteur dont le passage n'existe pas encore (story 7.3, FR-10) : le navigateur ne garde
// que des slugs (store de la 7.2) ; l'action `recalculerPanier` renvoie les commandes par artiste, calculées
// par le serveur pour le pays du cookie. Ce composant n'additionne rien. Changement de pays (annoncé) :
// `PaysLivraison` rafraîchit la page et `pays.code` relance le recalcul. L'envoi du formulaire crée le
// passage et la réservation ; seules les œuvres livrées et disponibles du panier sont envoyées.

type Statut = 'chargement' | 'recalcul' | 'pret' | 'erreur'

const LIEN_BOUTON =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-6 font-sans text-xs uppercase tracking-widest text-foreground hover:border-foreground'

export function CoordonneesPanier({ pays, conseil }: { pays: { code: string; nom: string }; conseil?: ReactNode }) {
  const t = fr.coordonnees
  const routeur = useRouter()
  const slugs = useCartStore((s) => s.slugs)
  const [monte, setMonte] = useState(false)
  const [statut, setStatut] = useState<Statut>('chargement')
  const [panier, setPanier] = useState<PanierCompose | null>(null)
  const [essai, setEssai] = useState(0)
  const [annonce, setAnnonce] = useState('')
  const dernierPays = useRef<string | null>(null)
  const requete = useRef(0)

  useEffect(() => setMonte(true), [])

  // Recalcul serveur : au chargement, à chaque changement de slugs ou de pays, et sur « Réessayer ».
  useEffect(() => {
    if (!monte) return
    if (slugs.length === 0) {
      requete.current += 1
      setPanier(null)
      setStatut('pret')
      return
    }
    const numero = ++requete.current
    setStatut((avant) => (avant === 'chargement' ? avant : 'recalcul'))
    recalculerPanier(slugs)
      .catch(() => ({ ok: false as const }))
      .then((resultat) => {
        // Réponse périmée (un autre recalcul a démarré entre-temps) : ignorée.
        if (numero !== requete.current) return
        if (!resultat.ok) {
          setStatut('erreur')
          return
        }
        setPanier(resultat.panier)
        setStatut('pret')
        if (dernierPays.current !== null && dernierPays.current !== resultat.panier.pays.code) {
          setAnnonce(fr.panier.recalcule(resultat.panier.pays.nom))
        }
        dernierPays.current = resultat.panier.pays.code
      })
  }, [monte, slugs, pays.code, essai])

  function titreDe(slug: string): string | null {
    for (const c of panier?.commandes ?? []) {
      const ligne = c.lignes.find((l) => l.slug === slug)
      if (ligne) return ligne.titre
    }
    return null
  }

  function messageRefus(reponse: Extract<ReponseCoordonnees, { ok: false }>): string {
    switch (reponse.code) {
      case 'oeuvre_indisponible': {
        const titre = titreDe(reponse.slug)
        // La liste est recalculée : la ligne indisponible apparaît avec ses œuvres proches.
        setEssai((n) => n + 1)
        return titre ? t.refus.oeuvreIndisponible(titre) : t.refus.oeuvreSansTitre
      }
      case 'non_livree':
        setEssai((n) => n + 1)
        return t.refus.nonLivree(titreDe(reponse.slug) ?? fr.panier.oeuvreSansTitre)
      case 'plafond_atteint':
        return t.refus.plafond
      case 'trop_de_demandes':
        return t.refus.tropDeDemandes
      case 'reservation_en_cours':
        return t.refus.reservationEnCours
      case 'prix_change':
        return t.refus.prixChange(titreDe(reponse.slug) ?? fr.panier.oeuvreSansTitre)
      case 'ferme':
        return t.refus.ferme
      case 'devise_differente':
        return t.monnaiesMelees
      default:
        return t.refus.indisponible
    }
  }

  const region = (contenu: ReactNode, occupe = false) => (
    <div aria-busy={occupe}>
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>
      {contenu}
    </div>
  )

  if (!monte) {
    return region(
      <div role="status" aria-busy="true">
        <p className="sr-only">{t.chargement}</p>
      </div>,
    )
  }

  if (slugs.length === 0) {
    return region(
      <div className="flex flex-col items-center rounded-sm border border-dashed border-neutral-200 px-6 py-24 text-center">
        <p className="font-serif text-heading-md text-foreground">{t.vide.titre}</p>
        <p className="mt-2 max-w-xs text-pretty font-sans text-sm text-neutral-600">{t.vide.aide}</p>
        <Link href="/galerie" className={`${LIEN_BOUTON} mt-8`}>
          {t.vide.parcourir}
        </Link>
      </div>,
    )
  }

  // Une seule arborescence pour tous les états : le formulaire reste monté (saisie conservée) pendant le
  // chargement, un recalcul ou une erreur ; seul l'envoi est bloqué, avec son explication.
  const masque = statut === 'recalcul' || statut === 'chargement'
  const enErreur = statut === 'erreur'
  const commandes = panier?.commandes ?? []
  const indisponibles = panier?.indisponibles ?? []
  const total = panier?.total
  const aEnvoyer = commandes.flatMap((c) => c.lignes.filter((l) => l.prixLivre.livree).map((l) => l.slug))
  const monnaiesMelees = Boolean(total && total.livrees > 0 && total.devise === null)
  const maximum = PLAFONDS_RESERVATION.parEmail

  let blocage: { explication: string; id: string } | null = null
  if (enErreur) blocage = { explication: t.erreur, id: 'coordonnees-blocage' }
  else if (masque || !panier) blocage = { explication: t.recalculEnCours, id: 'coordonnees-blocage' }
  else if (total && total.nonLivrees > 0) blocage = { explication: t.nonLivreesBloque, id: 'coordonnees-blocage' }
  else if (monnaiesMelees) blocage = { explication: t.monnaiesMelees, id: 'coordonnees-blocage' }
  else if (aEnvoyer.length === 0) blocage = { explication: t.vide.titre, id: 'coordonnees-blocage' }
  else if (aEnvoyer.length > maximum) blocage = { explication: t.refus.panierTropGrand(maximum), id: 'coordonnees-blocage' }

  return region(
    <>
      <PaysLivraison code={pays.code} nom={pays.nom} className="mb-6" />

      {statut === 'chargement' && (
        <div role="status" aria-busy="true" className="mb-6">
          <p className="sr-only">{t.chargement}</p>
          <div aria-hidden="true" className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 rounded-sm bg-neutral-200" />
            ))}
          </div>
        </div>
      )}

      {enErreur && (
        <div className="mb-6 rounded-sm border border-neutral-200 p-6">
          <p role="alert" className="font-sans text-base text-foreground">
            {t.erreur}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatut('recalcul')
              setEssai((n) => n + 1)
            }}
            className={`${LIEN_BOUTON} mt-4`}
          >
            {t.reessayer}
          </button>
        </div>
      )}

      {statut === 'recalcul' && (
        <p role="status" className="mb-6 font-sans text-sm text-neutral-600">
          {t.recalculEnCours}
        </p>
      )}

      {commandes.length > 0 && (
        <ol className="flex flex-col gap-6">
          {commandes.map((commande) => (
            <li key={commande.artiste.slug}>
              <CarteCommande commande={commande} pays={pays.nom} masque={masque} />
            </li>
          ))}
        </ol>
      )}

      {indisponibles.length > 0 && (
        <ul className="mt-6 flex flex-col gap-6">
          {indisponibles.map((ligne) => (
            <li key={ligne.slug}>
              <LigneIndisponibleVue ligne={ligne} pays={pays.nom} />
            </li>
          ))}
        </ul>
      )}

      {panier && total && commandes.length > 0 && <TotalGeneral commandes={commandes} total={total} masque={masque} />}

      <p className="mt-6 font-sans text-sm text-neutral-600">
        <Link href="/panier" className="underline underline-offset-4">
          {t.panier}
        </Link>
      </p>

      <div className="mt-10">
        <p className="mb-6 font-sans text-sm text-foreground">{t.sansCompte}</p>
        <FormulaireCoordonnees
          champs={['email', 'nom', 'adresse', 'telephone']}
          envoyer={(saisie) => envoyerCoordonnees(aEnvoyer, saisie)}
          libelleEnvoi={t.envoyer}
          libelleEnCours={t.envoiEnCours}
          messageRefus={messageRefus}
          surSucces={() => routeur.refresh()}
          blocage={blocage}
        />
      </div>

      {conseil && (
        <div className="mt-10">
          <p className="mb-2 font-sans text-sm text-neutral-600">{t.conseilTitre}</p>
          {conseil}
        </div>
      )}
    </>,
    masque,
  )
}
