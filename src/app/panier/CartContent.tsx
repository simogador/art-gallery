'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArtworkImage } from '@/components/ui/ArtworkImage'
import { PaysLivraison } from '@/components/ui/PaysLivraison'
import { VignetteOeuvre } from '@/app/galerie/VignetteOeuvre'
import { useCartStore } from '@/lib/store/cart'
import { fr, formaterMontant, MONTANT_ABSENT } from '@/lib/i18n'
import type { CommandePanier, LigneIndisponible, LignePanier, PanierCompose } from '@/lib/panier'
import type { SommePrixLivres } from '@/lib/livraison/prix'
import { recalculerPanier } from './actions'

// Panier public (FR-10, FR-11, story 7.2). Le navigateur ne garde que des slugs (store) ; chaque
// affichage et chaque changement de pays les envoie à l'action `recalculerPanier`, qui renvoie le panier
// recomposé par le serveur (une carte par artiste, œuvres indisponibles, totaux). Ce composant n'additionne
// rien : il met en forme les montants reçus. Les montants restent masqués tant qu'ils ne sont pas recalculés.

type Statut = 'chargement' | 'recalcul' | 'pret' | 'erreur'

const LIEN_BOUTON =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-6 font-sans text-xs uppercase tracking-widest text-foreground hover:border-foreground'

function montant(centimes: number, devise: string | null, masque: boolean): string {
  return masque || devise === null ? MONTANT_ABSENT : formaterMontant(centimes, devise)
}

export function CartContent({
  pays,
  achatOuvert,
  conseil,
}: {
  pays: { code: string; nom: string }
  achatOuvert: boolean
  conseil?: ReactNode
}) {
  const t = fr.panier
  const slugs = useCartStore((s) => s.slugs)
  const retirerSlug = useCartStore((s) => s.removeItem)
  const [monte, setMonte] = useState(false)
  const [statut, setStatut] = useState<Statut>('chargement')
  const [panier, setPanier] = useState<PanierCompose | null>(null)
  const [essai, setEssai] = useState(0)
  const [annonce, setAnnonce] = useState('')
  const dernierPays = useRef<string | null>(null)
  const requete = useRef(0)
  const zone = useRef<HTMLDivElement>(null)
  const lienVide = useRef<HTMLAnchorElement>(null)
  const focusVide = useRef(false)

  useEffect(() => setMonte(true), [])

  // Recalcul serveur : au chargement, à chaque changement de slugs, de pays ou sur « Réessayer ».
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
          setAnnonce(t.recalcule(resultat.panier.pays.nom))
        }
        dernierPays.current = resultat.panier.pays.code
      })
  }, [monte, slugs, pays.code, essai, t])

  function retirer(slug: string, titre: string | null) {
    retirerSlug(slug)
    setAnnonce(t.retire(titre ?? t.oeuvreSansTitre))
    // Dernière œuvre retirée : le focus passe au lien de l'état vide, sinon à la zone du panier.
    if (slugs.length <= 1) focusVide.current = true
    else zone.current?.focus()
  }

  useEffect(() => {
    if (focusVide.current && slugs.length === 0 && statut === 'pret') {
      focusVide.current = false
      lienVide.current?.focus()
    }
  }, [slugs, statut])

  // Région d'annonce et zone de focus stables dans toutes les branches (y compris l'état vide) : un
  // retrait annoncé après le dernier article n'est pas perdu avec le démontage de la liste.
  const enveloppe = (contenu: ReactNode, occupe = false) => (
    <div ref={zone} tabIndex={-1} aria-busy={occupe} className="outline-none">
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>
      {contenu}
    </div>
  )

  if (!monte || statut === 'chargement') {
    return enveloppe(
      <div role="status" aria-busy="true">
        <p className="sr-only">{t.chargement}</p>
        <div aria-hidden="true" className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-sm bg-neutral-200" />
          ))}
        </div>
      </div>,
    )
  }

  if (slugs.length === 0) {
    return enveloppe(
      <div className="flex flex-col items-center rounded-sm border border-dashed border-neutral-200 px-6 py-24 text-center">
        <p className="font-serif text-heading-md text-foreground">{t.vide}</p>
        <p className="mt-2 max-w-xs text-pretty font-sans text-sm text-neutral-600">{t.videAide}</p>
        <Link ref={lienVide} href="/galerie" className={`${LIEN_BOUTON} mt-8`}>
          {t.parcourir}
        </Link>
      </div>,
    )
  }

  // Erreur de recalcul, ou nouvel essai sans panier à montrer : le panier (slugs) est conservé, les
  // montants restent masqués ; « Réessayer » est désactivé pendant l'essai et un nouvel échec est annoncé.
  if (statut === 'erreur' || !panier) {
    const enEssai = statut === 'recalcul'
    return enveloppe(
      <div className="rounded-sm border border-neutral-200 p-6">
        {enEssai ? (
          <p role="status" className="font-sans text-base text-foreground">
            {t.recalculEnCours}
          </p>
        ) : (
          <p role="alert" className="font-sans text-base text-foreground">
            {t.erreur}
          </p>
        )}
        <button
          type="button"
          disabled={enEssai}
          onClick={() => {
            setStatut('recalcul')
            setEssai((n) => n + 1)
          }}
          className={`${LIEN_BOUTON} mt-4 disabled:text-neutral-600`}
        >
          {t.reessayer}
        </button>
      </div>,
      enEssai,
    )
  }

  const masque = statut === 'recalcul'
  const { total, commandes } = panier
  const peutContinuer =
    achatOuvert && !masque && commandes.length > 0 && total.nonLivrees === 0 && total.devise !== null

  const colisLivres = commandes.filter((c) => c.somme.livrees > 0)
  const monnaiesMelees = total.livrees > 0 && total.devise === null

  return enveloppe(
    <>
      <PaysLivraison code={pays.code} nom={pays.nom} className="mb-6" />

      {masque && (
        <p role="status" className="mb-6 font-sans text-sm text-neutral-600">
          {t.recalculEnCours}
        </p>
      )}

      {!masque && colisLivres.length > 1 && (
        <p className="mb-6 rounded-sm border border-neutral-200 bg-neutral-100 px-4 py-3 font-sans text-sm text-foreground">
          {t.colis(
            colisLivres.length,
            colisLivres.map((c) => t.delaiCourt(c.somme.delaiMinJours, c.somme.delaiMaxJours)),
          )}
        </p>
      )}

      {commandes.length > 0 && (
        <ol className="flex flex-col gap-6">
          {commandes.map((commande) => (
            <li key={commande.artiste.slug}>
              <CarteCommande commande={commande} pays={pays.nom} masque={masque} onRetirer={(l) => retirer(l.slug, l.titre)} />
            </li>
          ))}
        </ol>
      )}

      {panier.indisponibles.length > 0 && (
        <ul className="mt-6 flex flex-col gap-6">
          {panier.indisponibles.map((ligne) => (
            <li key={ligne.slug}>
              <LigneIndisponibleVue ligne={ligne} pays={pays.nom} onRetirer={() => retirer(ligne.slug, ligne.titre)} />
            </li>
          ))}
        </ul>
      )}

      {commandes.length > 0 && <TotalGeneral commandes={commandes} total={total} masque={masque} />}

      {monnaiesMelees && !masque && <p className="mt-4 font-sans text-sm text-foreground">{t.monnaiesMelees}</p>}

      {total.nonLivrees > 0 && <p className="mt-4 font-sans text-sm text-neutral-600">{t.nonLivreesComptees(total.nonLivrees)}</p>}

      {!achatOuvert && commandes.length > 0 && (
        <p className="mt-8 text-pretty font-sans text-sm text-neutral-600">{t.achatFerme}</p>
      )}

      <div className="mt-10 flex flex-col items-start gap-6">
        <Link href="/galerie" className={LIEN_BOUTON}>
          {t.continuerParcourir}
        </Link>
        <div>
          <p className="mb-2 font-sans text-sm text-neutral-600">{t.conseilTitre}</p>
          {conseil}
        </div>
      </div>

      {achatOuvert && commandes.length > 0 && (
        <BarreContinuer
          peutContinuer={peutContinuer}
          total={total}
          nombre={commandes.length}
          masque={masque}
          explication={monnaiesMelees ? t.monnaiesMelees : t.corrigerAvantContinuer}
        />
      )}
    </>,
    masque,
  )
}

/* ─── Carte d'une commande (un artiste, un colis) ─────────────────────────── */

function CarteCommande({
  commande,
  pays,
  masque,
  onRetirer,
}: {
  commande: CommandePanier
  pays: string
  masque: boolean
  onRetirer: (ligne: LignePanier) => void
}) {
  const t = fr.panier
  const { somme } = commande
  const idTitre = `commande-${commande.numero}`
  return (
    <section aria-labelledby={idTitre} className="rounded-sm border border-neutral-200">
      <header className="border-b border-neutral-200 px-4 py-4 sm:px-6">
        <h2 id={idTitre} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
          {t.commande(commande.numero)}
        </h2>
        <p className="mt-1 font-serif text-heading-sm text-foreground">
          <Link href={`/artistes/${commande.artiste.slug}`} className="underline-offset-4 hover:underline">
            {commande.artiste.nom}
          </Link>
        </p>
      </header>

      <ul className="divide-y divide-neutral-200">
        {commande.lignes.map((ligne) => (
          <li key={ligne.slug} className="flex items-start gap-4 px-4 py-4 sm:px-6">
            <Link href={`/galerie/${ligne.slug}`} aria-label={ligne.titre} className="shrink-0">
              <span className="relative block h-20 w-16 overflow-hidden rounded-sm">
                <ArtworkImage
                  imageUrl={ligne.imageUrl}
                  title={ligne.titre}
                  alt=""
                  gradient={ligne.gradient}
                  accentColor={ligne.accentColor}
                  sizes="64px"
                />
              </span>
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/galerie/${ligne.slug}`} className="font-serif text-base text-foreground underline-offset-4 hover:underline">
                {ligne.titre}
              </Link>
              {ligne.prixLivre.livree ? (
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-sans text-sm">
                  <dt className="text-neutral-600">{t.prixOeuvre}</dt>
                  <dd className="text-end text-foreground">
                    {montant(ligne.prixOeuvreCentimes ?? 0, ligne.prixLivre.devise, masque)}
                  </dd>
                  <dt className="text-neutral-600">{t.livraisonLigne}</dt>
                  <dd className="text-end text-foreground">{montant(ligne.prixLivre.fraisCentimes, ligne.prixLivre.devise, masque)}</dd>
                </dl>
              ) : (
                <p className="mt-2 font-sans text-sm text-foreground">{t.nonLivree(pays)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRetirer(ligne)}
              aria-label={t.retirer(ligne.titre)}
              className="inline-flex min-h-touch-target min-w-touch-target shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:text-foreground"
            >
              <IconeRetirer />
            </button>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-neutral-200 px-4 py-4 font-sans text-sm sm:px-6">
        <dt className="text-neutral-600">{t.delai}</dt>
        <dd className="text-end text-foreground">
          {masque || somme.livrees === 0 ? MONTANT_ABSENT : t.delaiCourt(somme.delaiMinJours, somme.delaiMaxJours)}
        </dd>
        <dt className="text-neutral-600">{t.livraisonLigne}</dt>
        <dd className="text-end text-foreground">{montant(somme.fraisCentimes, somme.devise, masque)}</dd>
        <dt className="text-foreground">{t.sousTotal}</dt>
        <dd className="text-end font-serif text-lg text-foreground">{montant(somme.totalCentimes, somme.devise, masque)}</dd>
      </dl>
    </section>
  )
}

/* ─── Œuvre devenue indisponible ──────────────────────────────────────────── */

function LigneIndisponibleVue({ ligne, pays, onRetirer }: { ligne: LigneIndisponible; pays: string; onRetirer: () => void }) {
  const t = fr.panier
  return (
    <div className="rounded-sm border border-neutral-200 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-serif text-base text-neutral-600 line-through">{ligne.titre ?? t.oeuvreSansTitre}</p>
          <p role="status" className="mt-1 font-sans text-sm text-foreground">
            {t.indisponible}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={t.retirer(ligne.titre ?? t.oeuvreSansTitre)}
          className="inline-flex min-h-touch-target min-w-touch-target shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:text-foreground"
        >
          <IconeRetirer />
        </button>
      </div>
      {ligne.proches.length > 0 && (
        <div className="mt-6">
          <h2 className="font-sans text-xs uppercase tracking-widest text-neutral-600">{t.proches(ligne.artisteNom)}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
            {ligne.proches.map((o) => (
              <li key={o.id}>
                <VignetteOeuvre artwork={o} paysNom={pays} niveau="h3" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── Total général ───────────────────────────────────────────────────────── */

function TotalGeneral({ commandes, total, masque }: { commandes: CommandePanier[]; total: SommePrixLivres; masque: boolean }) {
  const t = fr.panier
  const montrerAddition = commandes.length > 1 && !masque && total.devise !== null
  return (
    <section aria-labelledby="total-general" className="mt-8 rounded-sm border border-neutral-200 px-4 py-4 sm:px-6">
      <h2 id="total-general" className="font-sans text-xs uppercase tracking-widest text-neutral-600">
        {t.totalGeneral}
      </h2>
      {montrerAddition && (
        <p className="mt-2 font-sans text-sm text-neutral-600">
          {t.additionTotaux(commandes.map((c) => montant(c.somme.totalCentimes, c.somme.devise, false)))}
        </p>
      )}
      <p className="mt-1 font-serif text-display-md text-foreground">
        {masque ? t.montantsMasques : montant(total.totalCentimes, total.devise, false)}
      </p>
      {!masque && total.devise !== null && <p className="mt-1 font-sans text-sm text-neutral-600">{fr.livraison.droitsNonInclus}</p>}
    </section>
  )
}

/* ─── Barre fixe « Continuer » (Lot 2 ouvert seulement) ───────────────────── */

function BarreContinuer({
  peutContinuer,
  total,
  nombre,
  masque,
  explication,
}: {
  peutContinuer: boolean
  total: SommePrixLivres
  nombre: number
  masque: boolean
  explication: string
}) {
  const t = fr.panier
  return (
    <div className="fixed inset-x-0 bottom-[var(--hauteur-banniere,0px)] z-30 border-t border-neutral-200 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-lg text-foreground">{montant(total.totalCentimes, total.devise, masque)}</p>
          <p id="explication-continuer" className="font-sans text-xs text-neutral-600">
            {peutContinuer || masque ? t.sousLigneContinuer(nombre) : explication}
          </p>
        </div>
        {peutContinuer ? (
          <Link
            href="/commande/coordonnees"
            className="inline-flex min-h-touch-target items-center justify-center rounded-sm bg-foreground px-8 font-sans text-sm text-background"
          >
            {t.continuer}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-describedby="explication-continuer"
            className="inline-flex min-h-touch-target items-center justify-center rounded-sm bg-neutral-200 px-8 font-sans text-sm text-neutral-600"
          >
            {t.continuer}
          </button>
        )}
      </div>
    </div>
  )
}

function IconeRetirer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />
    </svg>
  )
}
