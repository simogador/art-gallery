'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { millimetresEnCentimetres } from '@/lib/catalogue/conversions'
import {
  AMBIANCES,
  apercuDimensions,
  centimesEnSaisie,
  CHAMPS_OFFRE,
  COULEURS_DOMINANTES,
  elementsManquants,
  ENGAGEMENTS,
  erreurChampOffre,
  etatSections,
  ID_CHAMP,
  LIBELLES_CHAMPS,
  LIMITES_DEPOT,
  longueur,
  MESSAGE_NON_ENREGISTRE,
  NOMBRE_SECTIONS,
  nombreSectionsCompletes,
  NON,
  offreEnSaisie,
  OUI,
  PHOTOS,
  remplissageOffre,
  validerChamp,
  type ChampDepot,
  type ChampOffre,
  type DepotLu,
  type DonneesDepot,
  type EtatSection,
  type IdSection,
  type SaisieOffre,
  type TypePhoto,
  type ZoneDepot,
} from '@/lib/curation/depot-regles'
import { DeleteButton } from '@/components/dashboard/DeleteButton'
import {
  actionEnregistrerChamp,
  actionEnregistrerOffre,
  actionEnregistrerPhoto,
  actionEnvoyerEnCuration,
  actionPreparerEnvoi,
  actionReprendreZones,
} from './actions'
import { CasePhoto } from './CasePhoto'
import { SectionExpedition, type ErreursZone } from './SectionExpedition'

// Formulaire de dépôt (story 2.5, FR-20) : une seule page en cinq sections. Chaque champ est
// validé et enregistré à sa sortie (jamais à chaque frappe) ; une valeur refusée reste affichée
// avec son erreur. Les enregistrements passent un par un dans une file : le premier crée le
// brouillon, les suivants utilisent son slug (qui suit le titre tant que l'œuvre est en brouillon).
// Story 2.6 : expédition par zone, visites en atelier, engagements, liste des éléments manquants
// (chaque lien place le focus sur le champ concerné) et envoi en curation.

type Valeurs = Record<ChampDepot, string>
type Statut = 'aucun' | 'enCours' | 'enregistre' | 'echec'

const VIDE: DonneesDepot = {
  titre: '', technique: '', annee: null, histoire: '', ambiance: null, couleurDominante: null,
  hauteurMm: null, largeurMm: null, profondeurMm: null, prixCentimes: null, photos: [],
  offres: [], visitesAtelier: null, engagementCertificat: false, engagementEmballage: false, engagementReprise: false,
}

const ouiNon = (v: boolean | null | undefined) => (v === true ? OUI : v === false ? NON : '')

function saisiesZones(d: DepotLu | null, zones: ZoneDepot[]): Record<string, SaisieOffre> {
  return Object.fromEntries(zones.map((z) => [z.id, offreEnSaisie(d?.offres.find((o) => o.zoneId === z.id))]))
}

/** Place le focus sur l'élément d'interface `id` (premier champ d'un groupe), après l'avoir fait défiler. */
function placerFocus(id: string) {
  // Champ d'une zone masqué (« Je ne livre pas » coché sans être enregistré) : sa case à cocher.
  const el = document.getElementById(id) ?? document.getElementById(id.replace(/-(frais|preparation|transportMin|transportMax)$/, '-nonLivree'))
  if (!el) return
  const cible =
    el instanceof HTMLFieldSetElement
      ? (el.querySelector<HTMLInputElement>('input:checked') ?? el.querySelector<HTMLInputElement>('input'))
      : el
  cible?.scrollIntoView({ block: 'center' })
  cible?.focus({ preventScroll: true })
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
    visitesAtelier: ouiNon(d?.visitesAtelier),
    engagementCertificat: d?.engagementCertificat ? OUI : NON,
    engagementEmballage: d?.engagementEmballage ? OUI : NON,
    engagementReprise: d?.engagementReprise ? OUI : NON,
  }
}

const idChamp = ID_CHAMP.champ
const idSection = ID_CHAMP.section

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

type PropsFormulaire = {
  depot: DepotLu | null
  /** Zones ouvertes par l'équipe. */
  zones: ZoneDepot[]
  /** Sans brouillon : une autre œuvre de l'artiste a des offres à reprendre. */
  repriseInitiale?: boolean
}

export function FormulaireDepot({ depot: initial, zones, repriseInitiale = false }: PropsFormulaire) {
  const [depot, setDepot] = useState<DepotLu | null>(initial)
  const [zonesSaisies, setZonesSaisies] = useState<Record<string, SaisieOffre>>(() => saisiesZones(initial, zones))
  const [erreursZones, setErreursZones] = useState<Record<string, ErreursZone>>({})
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [refusEnvoi, setRefusEnvoi] = useState<string | null>(null)
  // Dernière saisie enregistrée de chaque zone : une zone quittée sans changement n'est pas renvoyée.
  const zonesEnregistrees = useRef<Record<string, SaisieOffre>>(saisiesZones(initial, zones))
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

  /* ── Expédition par zone ── */

  const envoyerZone = useCallback(
    (zoneId: string, saisie: SaisieOffre, erreursApres: ErreursZone = {}) => {
      // Échec : erreur affichée au niveau de la zone (les champs peuvent être masqués) et case
      // « Je ne livre pas » ramenée à son dernier état enregistré.
      const echouer = () => {
        setErreursZones((e) => ({ ...e, [zoneId]: { ...erreursApres, zone: MESSAGE_NON_ENREGISTRE } }))
        const nonLivreeEnregistree = zonesEnregistrees.current[zoneId]?.nonLivree ?? false
        setZonesSaisies((z) => ({ ...z, [zoneId]: { ...z[zoneId], nonLivree: nonLivreeEnregistree } }))
      }
      enFile(async () => {
        try {
          const r = await actionEnregistrerOffre(slug.current, zoneId, saisie)
          if (r.ok) {
            zonesEnregistrees.current = { ...zonesEnregistrees.current, [zoneId]: saisie }
            setErreursZones((e) => ({ ...e, [zoneId]: erreursApres }))
            appliquer(r.depot)
          } else if (r.code === 'valeur_invalide' && r.erreursOffre) {
            setErreursZones((e) => ({ ...e, [zoneId]: r.erreursOffre ?? {} }))
          } else {
            echouer()
            setMessageGlobal(r.message)
          }
          return r
        } catch (erreur) {
          echouer()
          throw erreur
        }
      }).catch(() => undefined)
    },
    [appliquer, enFile],
  )

  const memeSaisie = (a: SaisieOffre | undefined, b: SaisieOffre) =>
    !!a && a.nonLivree === b.nonLivree && CHAMPS_OFFRE.every((c) => a[c].trim() === b[c].trim())

  /** Valide la zone à la sortie d'un champ ; l'enregistre quand ses quatre valeurs sont valides. */
  const sortieZone = (zoneId: string, saisie: SaisieOffre) => {
    const erreurs: ErreursZone = {}
    for (const c of CHAMPS_OFFRE) {
      const e = saisie[c].trim() === '' ? null : erreurChampOffre(c, saisie)
      if (e) erreurs[c] = e
    }
    const enregistree = zonesEnregistrees.current[zoneId]
    const remplissage = remplissageOffre(saisie)
    if (remplissage === 'partiel') erreurs.zone = MESSAGE_ZONE_INCOMPLETE
    setErreursZones((e) => ({ ...e, [zoneId]: erreurs }))
    if (Object.keys(erreurs).length) {
      // Saisie incomplète ou invalide : l'offre enregistrée (livrée ou non) est retirée, pour que la
      // zone compte comme manquante au lieu d'envoyer en curation des valeurs périmées.
      const offreEnregistree = !!enregistree && (enregistree.nonLivree || remplissageOffre(enregistree) !== 'vide')
      if (offreEnregistree) envoyerZone(zoneId, SAISIE_ZONE_VIDE, erreurs)
      return
    }
    if (memeSaisie(enregistree, saisie)) return
    envoyerZone(zoneId, saisie)
  }

  const saisirZone = (zoneId: string, champ: ChampOffre, valeur: string) =>
    setZonesSaisies((z) => ({ ...z, [zoneId]: { ...z[zoneId], [champ]: valeur } }))

  const nonLivree = (zoneId: string, valeur: boolean) => {
    const saisie = { ...zonesSaisies[zoneId], nonLivree: valeur }
    setZonesSaisies((z) => ({ ...z, [zoneId]: saisie }))
    if (valeur) {
      setErreursZones((e) => ({ ...e, [zoneId]: {} }))
      envoyerZone(zoneId, saisie)
    } else {
      sortieZone(zoneId, saisie)
    }
  }

  const reprendre = () => {
    if (depot?.offres.length && !window.confirm('Remplacer les frais et délais déjà indiqués par ceux de votre dernière œuvre ?')) return
    enFile(async () => {
      try {
        const r = await actionReprendreZones(slug.current)
        if (r.ok) {
          appliquer(r.depot)
          const saisies = saisiesZones(r.depot, zones)
          zonesEnregistrees.current = saisies
          setZonesSaisies(saisies)
          setErreursZones({})
        } else {
          setMessageGlobal(r.message)
        }
        return r
      } catch (erreur) {
        setMessageGlobal(MESSAGE_NON_ENREGISTRE)
        throw erreur
      }
    }).catch(() => undefined)
  }

  /* ── Envoi en curation ── */

  const envoyer = async () => {
    setRefusEnvoi(null)
    setEnvoiEnCours(true)
    try {
      // Les enregistrements en cours passent d'abord ; le serveur revérifie la complétude.
      await file.current
      const r = await actionEnvoyerEnCuration(slug.current)
      // En cas de succès, l'action redirige vers « Mes œuvres » et ne revient pas ici.
      if (r && !r.ok) setRefusEnvoi(r.message)
    } catch {
      setRefusEnvoi(MESSAGE_NON_ENREGISTRE)
    } finally {
      setEnvoiEnCours(false)
    }
  }

  const sections = useMemo(() => etatSections(depot ?? VIDE, zones), [depot, zones])
  const manquants = useMemo(() => elementsManquants(depot ?? VIDE, zones), [depot, zones])
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
          Repère d&apos;échelle : une chaise, une personne, un meuble connu. Photos de 10 Mo au plus, vidéo de 100 Mo au plus.
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
            libelle={LIBELLES_CHAMPS.ambiance}
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
            libelle={LIBELLES_CHAMPS.couleurDominante}
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

      {/* ── 4. Expédition ── */}
      <Section etat={section('expedition')}>
        <div className="flex flex-col gap-8">
          <SectionExpedition
            zones={zones}
            saisies={zonesSaisies}
            erreurs={erreursZones}
            repriseDisponible={depot ? depot.repriseDisponible : repriseInitiale}
            onSaisie={saisirZone}
            onSortie={(zoneId) => sortieZone(zoneId, zonesSaisies[zoneId])}
            onNonLivree={nonLivree}
            onReprendre={reprendre}
          />
          <Choix
            champ="visitesAtelier"
            libelle={LIBELLES_CHAMPS.visitesAtelier}
            options={OPTIONS_OUI_NON}
            valeur={valeurs.visitesAtelier}
            erreur={erreurs.visitesAtelier}
            onChoix={(v) => choisir('visitesAtelier', v)}
          />
        </div>
      </Section>

      {/* ── 5. Engagements ── */}
      <Section etat={section('engagements')}>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-sans text-sm text-neutral-600 mb-2">Cochez les trois engagements pour pouvoir envoyer l&apos;œuvre.</legend>
          {ENGAGEMENTS.map((champ) => (
            <div key={champ}>
              <label htmlFor={idChamp(champ)} className="min-h-[44px] flex items-center gap-3 font-sans text-sm text-foreground cursor-pointer">
                <input
                  id={idChamp(champ)}
                  type="checkbox"
                  checked={valeurs[champ] === OUI}
                  onChange={(e) => choisir(champ, e.target.checked ? OUI : NON)}
                  aria-describedby={erreurs[champ] ? `${idChamp(champ)}-erreur` : undefined}
                  className="w-5 h-5 flex-shrink-0 accent-foreground"
                />
                {LIBELLES_CHAMPS[champ]}
              </label>
              {erreurs[champ] && (
                <p id={`${idChamp(champ)}-erreur`} role="alert" className="font-sans text-xs text-red-600">
                  Erreur : {erreurs[champ]}
                </p>
              )}
            </div>
          ))}
        </fieldset>
      </Section>

      {/* ── Envoi en curation ── */}
      <div className="border border-neutral-200 rounded-sm p-5">
        {manquants.length > 0 ? (
          <>
            <p id="depot-manquants" className="font-sans text-sm text-foreground font-medium">
              Il manque {manquants.length} élément{manquants.length > 1 ? 's' : ''} pour envoyer :
            </p>
            <ul className="mt-2 flex flex-col">
              {manquants.map((m) => (
                <li key={m.cible + m.libelle}>
                  <a
                    href={`#${m.cible}`}
                    onClick={(e) => {
                      e.preventDefault()
                      placerFocus(m.cible)
                    }}
                    className="min-h-[44px] inline-flex items-center font-sans text-sm text-foreground underline underline-offset-4"
                  >
                    {m.libelle}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p id="depot-manquants" className="font-sans text-sm text-foreground">
            Toutes les sections sont complètes : vous pouvez envoyer l&apos;œuvre à l&apos;équipe Errancy.
          </p>
        )}
        {refusEnvoi && (
          <p role="alert" className="font-sans text-sm text-red-600 mt-3">
            {refusEnvoi}
          </p>
        )}
        <button
          type="button"
          onClick={envoyer}
          disabled={manquants.length > 0 || envoiEnCours || !depot}
          aria-describedby="depot-manquants"
          className="mt-4 min-h-[44px] px-6 bg-foreground text-background rounded-sm font-sans text-xs uppercase tracking-widest hover:bg-neutral-700 transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {envoiEnCours ? 'Envoi…' : 'Envoyer en curation'}
        </button>
        <p className="font-sans text-xs text-neutral-500 mt-2">
          Une fois envoyée, l&apos;œuvre ne se modifie plus pendant que l&apos;équipe l&apos;examine.
        </p>
      </div>

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

const MESSAGE_ZONE_INCOMPLETE = 'Complétez les quatre valeurs ou cochez « Je ne livre pas cette zone ».'
const SAISIE_ZONE_VIDE: SaisieOffre = { nonLivree: false, frais: '', preparation: '', transportMin: '', transportMax: '' }

const OPTIONS_OUI_NON = [
  { code: OUI, libelle: 'Oui' },
  { code: NON, libelle: 'Non' },
] as const

function Section({ etat, children }: { etat: EtatSection; children: ReactNode }) {
  return (
    <section id={idSection(etat.id)} tabIndex={-1} aria-labelledby={`${idSection(etat.id)}-titre`} className="border-t border-neutral-200 pt-8 scroll-mt-24">
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
  champ, libelle, options, valeur, erreur, onChoix,
}: {
  champ: ChampDepot
  libelle: string
  options: readonly { code: string; libelle: string }[]
  valeur: string
  erreur?: string
  onChoix: (code: string) => void
}) {
  const id = idChamp(champ)
  return (
    <fieldset id={id} aria-describedby={erreur ? `${id}-erreur` : undefined} aria-invalid={erreur ? true : undefined}>
      <legend className="font-sans text-sm font-medium text-foreground mb-2">{libelle}</legend>
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
