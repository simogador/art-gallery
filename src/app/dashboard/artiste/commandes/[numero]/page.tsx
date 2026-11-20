import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { commandeDeLArtiste } from '@/lib/commandes'
import { fr, formaterMontant } from '@/lib/i18n'
import { SEUIL_ASSURANCE } from '@/lib/reglages'
import { FormulaireExpedition } from '../FormulaireExpedition'
import { HeureFixe } from '../HeureFixe'
import { PriseEnCharge } from '../PriseEnCharge'

// Une commande de l'artiste (story 8.1, FR-22, AD-15, AD-16, UJ-2). Accès décidé par `commandes` à partir de
// l'acteur relu en base : commande d'un autre artiste, inconnue ou hors des états `confirmee`/`prise_en_charge`/`expediee`/`livree` :
// 404, sans dire si elle existe. Avant la prise en charge : œuvres, prénom et pays, échéance en heure fixe et zone
// neutre à la place de l'adresse ; après : adresse, téléphone et rappel du guide d'emballage. Commande `livree` (story 8.4) : lecture seule, sans
// adresse ni téléphone. Aucun montant.

export const dynamic = 'force-dynamic'

const t = fr.commandesArtiste

type Props = { params: { numero: string } }

/** Numéro décodé de l'adresse, ou null si l'encodage est invalide (jamais d'exception). */
function numeroDe(brut: string): string | null {
  try {
    return decodeURIComponent(brut)
  } catch {
    return null
  }
}

export function generateMetadata({ params }: Props): Metadata {
  const numero = numeroDe(params.numero)
  return { title: numero ? t.titreDocumentCommande(numero) : t.titreDocument, robots: { index: false, follow: false } }
}

export default async function CommandeArtistePage({ params }: Props) {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  const numero = numeroDe(params.numero)
  if (numero === null) notFound()
  const lu = await commandeDeLArtiste(acteur, numero)
  if (!lu.ok) notFound()
  const commande = lu.commande
  const livree = commande.etat === 'livree'
  const expediee = commande.etat === 'expediee'
  // Adresse et téléphone : prise en charge et expédition seulement (AD-16) ; une commande livrée (8.4) reste lisible,
  // sans adresse ni téléphone.
  const prise = commande.etat === 'prise_en_charge' || expediee
  const exp = commande.expedition

  return (
    <div className="max-w-2xl">
      <div className="mb-10">
        <Link
          href="/dashboard/artiste/commandes"
          className="inline-flex min-h-touch-target items-center font-sans text-xs uppercase tracking-widest text-neutral-600 hover:text-foreground"
        >
          {t.retour}
        </Link>
        <h1 className="mt-2 font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          {t.commande(commande.numero)}
        </h1>
        <p className="mt-2 font-sans text-sm text-foreground">{livree ? t.etats.livree : expediee ? t.etats.expediee : prise ? t.etats.prise : t.etats.aPrendre}</p>
      </div>

      <section aria-labelledby="oeuvres" className="mb-8">
        <h2 id="oeuvres" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
          {t.oeuvres}
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-sm border border-neutral-200">
          {commande.oeuvres.map((titre, i) => (
            <li key={`${i}-${titre}`} className="px-4 py-3 font-serif text-base text-foreground">
              {titre}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="acheteur" className="mb-8">
        <h2 id="acheteur" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
          {t.acheteurTitre}
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-sans text-sm">
          <dt className="text-neutral-600">{t.prenom}</dt>
          <dd className="text-foreground">{commande.prenom}</dd>
          <dt className="text-neutral-600">{t.pays}</dt>
          <dd className="text-foreground">{commande.pays.nom}</dd>
        </dl>
      </section>

      <section aria-labelledby="echeance" className="mb-8">
        <h2 id="echeance" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
          {t.echeanceTitre}
        </h2>
        {livree ? (
          <p className="mt-3 font-sans text-sm text-foreground">
            {t.livreeLe} {commande.livreeLe && <HeureFixe iso={commande.livreeLe.toISOString()} />}
          </p>
        ) : expediee ? (
          <p className="mt-3 font-sans text-sm text-foreground">
            {t.expedieeLe} {commande.expedieeLe && <HeureFixe iso={commande.expedieeLe.toISOString()} />}
          </p>
        ) : prise ? (
          <p className="mt-3 font-sans text-sm text-foreground">
            {t.priseLe} {commande.priseEnChargeLe && <HeureFixe iso={commande.priseEnChargeLe.toISOString()} />}
          </p>
        ) : commande.priseEnChargeAvant ? (
          <p className="mt-3 font-sans text-sm text-foreground">
            {t.avant} <HeureFixe iso={commande.priseEnChargeAvant.toISOString()} />
          </p>
        ) : (
          <p className="mt-3 font-sans text-sm text-foreground">{t.sansEcheance}</p>
        )}
        {commande.echeanceDepassee && <p className="mt-2 font-sans text-sm font-medium text-foreground">{t.depassee}</p>}
      </section>

      {!livree && (
        <div className="mb-8">
          <PriseEnCharge numero={commande.numero} prise={prise} />
        </div>
      )}
      {prise && (
        <div className="mb-8">
          <FormulaireExpedition
            numero={commande.numero}
            assurance={commande.assuranceRequise === true}
            seuil={formaterMontant(SEUIL_ASSURANCE.centimes, SEUIL_ASSURANCE.devise)}
            expediee={expediee}
          />
        </div>
      )}
      {exp && (
        <section aria-labelledby="expedition" className="mb-8">
          <h2 id="expedition" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
            {t.expedition.fait.titre}
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-sans text-sm">
            <dt className="text-neutral-600">{t.expedition.fait.transporteur}</dt>
            <dd className="break-words text-foreground">{exp.transporteur}</dd>
            <dt className="text-neutral-600">{t.expedition.fait.numeroSuivi}</dt>
            <dd className="break-words text-foreground">{exp.numeroSuivi}</dd>
            {exp.envoiAssure && (
              <>
                <dt className="text-neutral-600">{t.expedition.fait.assure}</dt>
                <dd className="text-foreground">{t.expedition.fait.oui}</dd>
                {exp.referenceAssurance && (
                  <>
                    <dt className="text-neutral-600">{t.expedition.fait.reference}</dt>
                    <dd className="break-words text-foreground">{exp.referenceAssurance}</dd>
                  </>
                )}
              </>
            )}
          </dl>
        </section>
      )}

      {prise ? (
        <section aria-labelledby="livraison" className="mb-8">
          <h2 id="livraison" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
            {t.livraison.titre}
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-sans text-sm">
            <dt className="text-neutral-600">{t.livraison.adresse}</dt>
            <dd className="whitespace-pre-line break-words text-foreground">{commande.adresse ?? t.livraison.adresseAttendue}</dd>
            <dt className="text-neutral-600">{t.livraison.telephone}</dt>
            <dd className="break-words text-foreground">{commande.telephone ?? t.livraison.nonRenseigne}</dd>
          </dl>
        </section>
      ) : livree ? (
        <p data-livraison-masquee className="mb-8 font-sans text-sm text-neutral-600">
          {t.livraisonMasquee}
        </p>
      ) : (
        <section aria-labelledby="zone-adresse" className="mb-8">
          <h2 id="zone-adresse" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
            {t.zoneNeutre.titre}
          </h2>
          <div className="relative mt-3 px-4 py-8 sm:px-8">
            <div aria-hidden="true" className="zone-neutre absolute inset-0" />
            <div className="relative mx-auto max-w-md rounded-sm border border-neutral-300 bg-white px-5 py-4 text-center">
              <p className="font-sans text-sm font-medium text-foreground">{t.zoneNeutre.etiquette}</p>
            </div>
          </div>
          <p className="mt-3 font-sans text-sm text-neutral-600">{t.zoneNeutre.texte}</p>
        </section>
      )}

      {prise && !expediee && (
        <section aria-labelledby="guide" className="mb-8">
          <h2 id="guide" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
            {t.guide.titre}
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 font-sans text-sm text-foreground">
            {t.guide.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
