'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { millimetresEnCentimetres } from '@/lib/catalogue/conversions'
import {
  AMBIANCES,
  apercuDimensions,
  centimesEnSaisie,
  COULEURS_DOMINANTES,
  etatSections,
  LIBELLES_CHAMPS,
  LIMITES_DEPOT,
  longueur,
  MESSAGE_NON_ENREGISTRE,
  NOMBRE_SECTIONS,
  nombreSectionsCompletes,
  PHOTOS,
  validerChamp,
  type ChampDepot,
  type DepotLu,
  type DonneesDepot,
  type EtatSection,
  type IdSection,
  type TypePhoto,
} from '@/lib/curation/depot-regles'
import { DeleteButton } from '@/components/dashboard/DeleteButton'
import { actionEnregistrerChamp, actionEnregistrerPhoto, actionPreparerEnvoi } from './actions'
import { CasePhoto } from './CasePhoto'

// Formulaire de dépôt (story 2.5, FR-20) : une seule page en cinq sections. Chaque champ est
// validé et enregistré à sa sortie (jamais à chaque frappe) ; une valeur refusée reste affichée
// avec son erreur. Les enregistrements passent un par un dans une file : le premier crée le
// brouillon, les suivants utilisent son slug (qui suit le titre tant que l'œuvre est en brouillon).

type Valeurs = Record<ChampDepot, string>
type Statut = 'aucun' | 'enCours' | 'enregistre' | 'echec'

const VIDE: DonneesDepot = {
  titre: '', technique: '', annee: null, histoire: '', ambiance: null, couleurDominante: null,
  hauteurMm: null, largeurMm: null, profondeurMm: null, prixCentimes: null, photos: [],
}

function valeursInitiales(d: DepotLu | null): Valeurs {
  return {
    titre: d?.titre ?? '',
    technique: d?.technique ?? '',
    annee: d?.annee === null || d?.annee === undefined ? '' : String(d.annee),
    histoire: d?.histoire ?? '',
    ambiance: d?.ambiance ?? '',
    hauteur: millimetresEnCentimetres(d?.hauteurMm),
    largeur: millimetresEnCentimetres(d?.largeurMm),
    profondeur: millimetresEnCentimetres(d?.profondeurMm),
    couleurDominante: d?.couleurDominante ?? '',
    prix: centimesEnSaisie(d?.prixCentimes ?? null),
  }
}

const idChamp = (champ: ChampDepot) => `depot-${champ}`
const idSection = (id: IdSection) => `section-${id}`

const CHEMIN_OEUVRES = '/dashboard/artiste/oeuvres'

/** Envoi direct du fichier à Cloudinary, avec la progression ; renvoie la réponse JSON ou null. */
function envoyerACloudinary(
  envoi: { cloudName: string; apiKey: string; timestamp: number; publicId: string; allowedFormats: string; signature: string },
  fichier: File,
  progression: (pourcent: number) => void,
): Promise<unknown | null> {
  return new Promise((resolve) => {
    const corps = new FormData()
    corps.append('file', fichier)
    corps.append('api_key', envoi.apiKey)
    corps.append('timestamp', String(envoi.timestamp))
    corps.append('public_id', envoi.publicId)
    corps.append('allowed_formats', envoi.allowedFormats)
    corps.append('signature', envoi.signature)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(envoi.cloudName)}/auto/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progression(Math.floor((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        resolve(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null)
      } catch {
        resolve(null)
      }
    }
    xhr.onerror = () => resolve(null)
    xhr.onabort = xhr.ontimeout = () => resolve(null)
    xhr.send(corps)
  })
}

export function FormulaireDepot({ depot: initial, expedition }: { depot: DepotLu | null; expedition: ReactNode }) {
  const [depot, setDepot] = useState<DepotLu | null>(initial)
  const [valeurs, setValeurs] = useState<Valeurs>(() => valeursInitiales(initial))
  const [erreurs, setErreurs] = useState<Partial<Record<ChampDepot, string>>>({})
  const [statut, setStatut] = useState<Statut>(initial ? 'enregistre' : 'aucun')
  const [messageGlobal, setMessageGlobal] = useState<string | null>(null)

  // Dernière valeur enregistrée de chaque champ : un champ quitté sans changement n'est pas renvoyé.
  const enregistrees = useRef<Valeurs>(valeursInitiales(initial))
  const slug = useRef<string | null>(initial?.slug ?? null)
  const file = useRef<Promise<unknown>>(Promise.resolve())
  const enAttente = useRef(0)
  const echec = useRef(false)

  // Avertit avant de quitter la page tant qu'un enregistrement est en cours.
  useEffect(() => {
    const avertir = (e: BeforeUnloadEvent) => {
      if (enAttente.current > 0) e.preventDefault()
    }
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [])

  // File des enregistrements : un à la fois, dans l'ordre. Quand elle se vide, l'en-tête dit si
  // tout a été enregistré depuis le dernier état affiché.
  const enFile = useCallback(<T extends { ok: boolean }>(tache: () => Promise<T>): Promise<T> => {
    enAttente.current += 1
    setStatut('enCours')
    const resultat = file.current.then(tache, tache)
    const terminer = (ok: boolean) => {
      echec.current = echec.current || !ok
      enAttente.current -= 1
      if (enAttente.current === 0) {
        setStatut(echec.current ? 'echec' : 'enregistre')
        echec.current = false
      }
    }
    file.current = resultat.then((r) => terminer(r.ok), () => terminer(false))
    return resultat
  }, [])

  const appliquer = useCallback((d: DepotLu) => {
    setDepot(d)
    setMessageGlobal(null)
    if (d.slug !== slug.current) {
      slug.current = d.slug
      // L'adresse suit le brouillon (rechargement, partage du lien) sans recharger le formulaire.
      window.history.replaceState(null, '', `${CHEMIN_OEUVRES}/${d.slug}`)
    }
  }, [])

  const enregistrer = useCallback(
    (champ: ChampDepot, valeur: string) => {
      if (valeur === enregistrees.current[champ]) {
        setErreurs((e) => ({ ...e, [champ]: undefined }))
        return
      }
      // Validation à la sortie du champ, sans aller-retour ; le serveur revalide.
      const lu = validerChamp(champ, valeur)
      if (!lu.ok) {
        setErreurs((e) => ({ ...e, [champ]: lu.erreur }))
        return
      }
      enFile(async () => {
        try {
          const r = await actionEnregistrerChamp(slug.current, champ, valeur)
          if (r.ok) {
            enregistrees.current = { ...enregistrees.current, [champ]: valeur }
            setErreurs((e) => ({ ...e, [champ]: undefined }))
            appliquer(r.depot)
          } else if (r.code === 'valeur_invalide') {
            setErreurs((e) => ({ ...e, [champ]: r.message }))
          } else {
            setErreurs((e) => ({ ...e, [champ]: MESSAGE_NON_ENREGISTRE }))
            setMessageGlobal(r.message)
          }
          return r
        } catch (erreur) {
          // Échec réseau ou serveur : la saisie reste affichée ; quitter de nouveau le champ réessaie.
          setErreurs((e) => ({ ...e, [champ]: MESSAGE_NON_ENREGISTRE }))
          throw erreur
        }
      }).catch(() => undefined)
    },
    [appliquer, enFile],
  )

  const envoyerPhoto = useCallback(
    async (type: TypePhoto, fichier: File, progression: (pourcent: number) => void): Promise<string | null> => {
      try {
        const preparation = await enFile(async () => {
          const r = await actionPreparerEnvoi(slug.current, type)
          if (r.ok && r.slug !== slug.current) {
            slug.current = r.slug
            window.history.replaceState(null, '', `${CHEMIN_OEUVRES}/${r.slug}`)
          }
          return r
        })
        if (!preparation.ok) return preparation.message
        // Envoi direct du navigateur vers Cloudinary, hors de la file : les champs restent enregistrables.
        const reponse = await envoyerACloudinary(preparation.envoi, fichier, progression)
        if (!reponse) return 'L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.'
        const r = await enFile(() => actionEnregistrerPhoto(slug.current, type, reponse))
        if (r.ok) appliquer(r.depot)
        return r.ok ? null : r.message
      } catch {
        return MESSAGE_NON_ENREGISTRE
      }
    },
    [appliquer, enFile],
  )

  const sections = useMemo(() => etatSections(depot ?? VIDE), [depot])
  const completes = nombreSectionsCompletes(sections)
  const section = (id: IdSection) => sections.find((s) => s.id === id)!
  const apercu = apercuDimensions(valeurs)

  const changer = (champ: ChampDepot) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValeurs((v) => ({ ...v, [champ]: e.target.value }))
  const quitter = (champ: ChampDepot) => () => enregistrer(champ, valeurs[champ])
  const choisir = (champ: ChampDepot, valeur: string) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }))
    enregistrer(champ, valeur)
  }
  const proprietes = (champ: ChampDepot) => ({
    id: idChamp(champ),
    value: valeurs[champ],
    onChange: changer(champ),
    onBlur: quitter(champ),
    erreur: erreurs[champ],
  })

  return (
    <div className="flex flex-col gap-12">
      {/* ── Progression ── */}
      <div className="border border-neutral-200 rounded-sm p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-sans text-sm text-foreground">
            <strong>{completes} section{completes > 1 ? 's' : ''} sur {NOMBRE_SECTIONS} complète{completes > 1 ? 's' : ''}</strong>
          </p>
          <p role="status" className="font-sans text-xs text-neutral-600">
            {statut === 'enCours'
              ? 'Enregistrement…'
              : statut === 'enregistre'
                ? 'Brouillon enregistré'
                : statut === 'echec'
                  ? MESSAGE_NON_ENREGISTRE
                  : 'Le brouillon est créé dès le premier champ rempli.'}
          </p>
        </div>
        {messageGlobal && (
          <p role="alert" className="font-sans text-sm text-red-600 mt-3">
            {messageGlobal}
          </p>
        )}
        <ol className="mt-4 flex flex-col divide-y divide-neutral-100">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <a href={`#${idSection(s.id)}`} className="min-h-[44px] flex items-center font-sans text-sm text-foreground underline-offset-4 hover:underline">
                {s.numero}. {s.titre}
              </a>
              <span className={`font-sans text-xs ${s.complet ? 'text-emerald-700' : 'text-neutral-600'}`}>
                <span aria-hidden="true">{s.complet ? '✓ ' : '○ '}</span>
                {s.complet ? 'Complet' : 'À compléter'}
              </span>
            </li>
          ))}
        </ol>
        <p className="font-sans text-xs text-neutral-500 mt-3">
          Votre brouillon n&apos;est visible que de vous. Chaque champ est enregistré quand vous le quittez.
        </p>
      </div>

      {/* ── 1. Photos ── */}
      <Section etat={section('photos')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PHOTOS.map((p) => (
            <CasePhoto
              key={p.type}
              type={p.type}
              legende={p.legende}
              obligatoire={p.obligatoire}
              nature={p.nature}
              url={depot?.photosLues[p.type]?.url ?? null}
              envoyer={envoyerPhoto}
            />
          ))}
        </div>
        <p className="font-sans text-xs text-neutral-500 mt-3">
          Repère d&apos;échelle : une chaise, une personne, un meuble connu. Photos de 20 Mo au plus, vidéo de 100 Mo au plus.
        </p>
      </Section>

      {/* ── 2. Informations ── */}
      <Section etat={section('informations')}>
        <div className="flex flex-col gap-6">
          <ChampTexte libelle={LIBELLES_CHAMPS.titre} {...proprietes('titre')} />
          <ChampTexte libelle={LIBELLES_CHAMPS.technique} aide="Par exemple « Acrylique sur toile »." {...proprietes('technique')} />
          <ChampTexte libelle={LIBELLES_CHAMPS.annee} inputMode="numeric" aide={`Année de réalisation, de ${LIMITES_DEPOT.anneeMin} à aujourd’hui.`} {...proprietes('annee')} />
          <ChampTexte
            libelle={LIBELLES_CHAMPS.histoire}
            multiligne
            aide={`${longueur(valeurs.histoire.trim())} / ${LIMITES_DEPOT.histoire} caractères. Ce que l’œuvre raconte, en quelques phrases.`}
            {...proprietes('histoire')}
          />
          <Choix
            champ="ambiance"
            options={AMBIANCES}
            valeur={valeurs.ambiance}
            erreur={erreurs.ambiance}
            onChoix={(v) => choisir('ambiance', v)}
          />
        </div>
      </Section>

      {/* ── 3. Dimensions et prix ── */}
      <Section etat={section('dimensions')}>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChampTexte libelle={LIBELLES_CHAMPS.hauteur} inputMode="decimal" {...proprietes('hauteur')} />
            <ChampTexte libelle={LIBELLES_CHAMPS.largeur} inputMode="decimal" {...proprietes('largeur')} />
            <ChampTexte libelle={LIBELLES_CHAMPS.profondeur} inputMode="decimal" {...proprietes('profondeur')} />
          </div>
          <p aria-live="polite" className="font-sans text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3">
            {apercu ? (
              <>Calculé automatiquement : <strong>{apercu}</strong></>
            ) : (
              'La conversion en pouces et l’orientation s’affichent dès que la hauteur et la largeur sont indiquées.'
            )}
          </p>
          <Choix
            champ="couleurDominante"
            options={COULEURS_DOMINANTES}
            valeur={valeurs.couleurDominante}
            erreur={erreurs.couleurDominante}
            onChoix={(v) => choisir('couleurDominante', v)}
          />
          <ChampTexte
            libelle={LIBELLES_CHAMPS.prix}
            inputMode="decimal"
            aide="Prix de l’œuvre seule, en euros (par exemple « 1 250,50 »). Les frais d’expédition s’ajoutent pour l’acheteur."
            {...proprietes('prix')}
          />
        </div>
      </Section>

      {/* ── 4. Expédition (saisie en story 2.6) ── */}
      <div id={idSection('expedition')} className="scroll-mt-24 [&>section]:mt-0">
        {expedition}
        <p className="font-sans text-xs text-neutral-600 mt-4">
          <span aria-hidden="true">○ </span>Section 4 · À compléter : {section('expedition').manques.join(', ')}
        </p>
      </div>

      {/* ── 5. Engagements (saisie en story 2.6) ── */}
      <Section etat={section('engagements')}>
        <p className="font-sans text-sm text-neutral-600">
          Vous pourrez bientôt confirmer vos engagements : certificat d&apos;authenticité signé, emballage
          conforme au guide Errancy et reprise d&apos;une œuvre retournée dans son emballage d&apos;origine.
        </p>
      </Section>

      {/* Brouillon abandonné : l'artiste peut le supprimer (slug courant, qui suit le titre). */}
      {depot && (
        <div className="border-t border-neutral-200 pt-6">
          <DeleteButton
            apiUrl={`/api/artiste/oeuvres/${depot.slug}`}
            label="Supprimer le brouillon"
            confirm={`Supprimer le brouillon « ${depot.titre || 'Sans titre'} » ? Ses photos et informations seront perdues.`}
            redirectTo={CHEMIN_OEUVRES}
          />
        </div>
      )}
    </div>
  )
}

function Section({ etat, children }: { etat: EtatSection; children: ReactNode }) {
  return (
    <section id={idSection(etat.id)} aria-labelledby={`${idSection(etat.id)}-titre`} className="border-t border-neutral-200 pt-8 scroll-mt-24">
      <h2 id={`${idSection(etat.id)}-titre`} className="font-serif font-light text-foreground text-2xl">
        {etat.numero}. {etat.titre}
      </h2>
      <p className="font-sans text-xs text-neutral-600 mt-1 mb-5">
        <span aria-hidden="true">{etat.complet ? '✓ ' : '○ '}</span>
        {etat.complet ? 'Complet' : `À compléter : ${etat.manques.join(', ')}`}
      </p>
      {children}
    </section>
  )
}

type ChampTexteProps = {
  id: string
  libelle: string
  value: string
  erreur?: string
  aide?: string
  multiligne?: boolean
  inputMode?: 'numeric' | 'decimal'
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur: () => void
}

function ChampTexte({ id, libelle, value, erreur, aide, multiligne, inputMode, onChange, onBlur }: ChampTexteProps) {
  const decrit = [aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined
  const classes = `w-full min-h-[44px] font-sans text-base text-foreground bg-transparent border rounded-sm px-4 py-2.5 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground ${erreur ? 'border-red-500' : 'border-neutral-300'}`
  const commun = {
    id, value, onChange, onBlur, autoComplete: 'off', 'aria-invalid': erreur ? true : undefined, 'aria-describedby': decrit,
  } as const
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-sans text-sm font-medium text-foreground">{libelle}</label>
      {multiligne ? (
        <textarea rows={4} className={`${classes} resize-y`} {...commun} />
      ) : (
        <input type="text" inputMode={inputMode} className={classes} {...commun} />
      )}
      {aide && <p id={`${id}-aide`} className="font-sans text-xs text-neutral-500">{aide}</p>}
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="font-sans text-xs text-red-600">
          Erreur : {erreur}
        </p>
      )}
    </div>
  )
}

function Choix({
  champ, options, valeur, erreur, onChoix,
}: {
  champ: 'ambiance' | 'couleurDominante'
  options: readonly { code: string; libelle: string }[]
  valeur: string
  erreur?: string
  onChoix: (code: string) => void
}) {
  const id = idChamp(champ)
  return (
    <fieldset id={id} aria-describedby={erreur ? `${id}-erreur` : undefined} aria-invalid={erreur ? true : undefined}>
      <legend className="font-sans text-sm font-medium text-foreground mb-2">{LIBELLES_CHAMPS[champ]}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const choisi = valeur === o.code
          return (
            <label
              key={o.code}
              className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 font-sans text-sm border rounded-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground ${choisi ? 'border-foreground border-2 bg-neutral-100 font-medium' : 'border-neutral-300'}`}
            >
              <input
                type="radio"
                name={id}
                value={o.code}
                checked={choisi}
                onChange={() => onChoix(o.code)}
                className="sr-only"
              />
              {choisi && <span aria-hidden="true">✓</span>}
              {o.libelle}
            </label>
          )
        })}
      </div>
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="font-sans text-xs text-red-600 mt-2">
          Erreur : {erreur}
        </p>
      )}
    </fieldset>
  )
}
