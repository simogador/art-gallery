import Link from 'next/link'
import { ArtworkImage } from '@/components/ui/ArtworkImage'
import { VignetteOeuvre } from '@/app/galerie/VignetteOeuvre'
import { fr, formaterMontant, MONTANT_ABSENT } from '@/lib/i18n'
import type { CommandePanier, LigneIndisponible, LignePanier } from '@/lib/panier'
import type { SommePrixLivres } from '@/lib/livraison/prix'

// Cartes du panier (story 7.2), partagées avec les coordonnées (story 7.3) : une carte par artiste,
// œuvres devenues indisponibles, total général. Elles mettent en forme les montants reçus du serveur et
// n'additionnent rien. Sans `onRetirer`, aucun bouton de retrait (page des coordonnées).

export function montant(centimes: number, devise: string | null, masque: boolean): string {
  return masque || devise === null ? MONTANT_ABSENT : formaterMontant(centimes, devise)
}

/* ─── Carte d'une commande (un artiste, un colis) ─────────────────────────── */

export function CarteCommande({
  commande,
  pays,
  masque,
  onRetirer,
}: {
  commande: CommandePanier
  pays: string
  masque: boolean
  onRetirer?: (ligne: LignePanier) => void
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
            {onRetirer && (
              <button
                type="button"
                onClick={() => onRetirer(ligne)}
                aria-label={t.retirer(ligne.titre)}
                className="inline-flex min-h-touch-target min-w-touch-target shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:text-foreground"
              >
                <IconeRetirer />
              </button>
            )}
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

export function LigneIndisponibleVue({ ligne, pays, onRetirer }: { ligne: LigneIndisponible; pays: string; onRetirer?: () => void }) {
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
        {onRetirer && (
          <button
            type="button"
            onClick={onRetirer}
            aria-label={t.retirer(ligne.titre ?? t.oeuvreSansTitre)}
            className="inline-flex min-h-touch-target min-w-touch-target shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:text-foreground"
          >
            <IconeRetirer />
          </button>
        )}
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

export function TotalGeneral({ commandes, total, masque }: { commandes: CommandePanier[]; total: SommePrixLivres; masque: boolean }) {
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


function IconeRetirer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />
    </svg>
  )
}
