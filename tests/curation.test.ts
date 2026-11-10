import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  controleComplet,
  controlesCoches,
  dateAccordEnSaisie,
  mentionAccord,
  validerCommentaire,
  validerDateAccord,
} from '@/lib/curation/curation-regles'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.7 (FR-25, FR-16) : curation par l'équipe — file, valider (accord signé et liste de
// contrôle exigés), renvoyer avec commentaire, décisions conservées, accord signé de l'artiste.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('@/lib/acces', async (original) => ({
  ...(await original<typeof import('@/lib/acces')>()),
  acteurCourant: async () => acteur.courant,
}))
// Story 3.4 : unstable_cache en passe-plat (pas de cache dans les tests), revalidateTag espionné.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  permanentRedirect: (url: string) => {
    throw new Error(`redirection-permanente:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ARTISTE = { type: 'artist', userId: 'utilisateur-1', artiste: { id: 'artiste-1', slug: 'mustapha-timija', name: 'Mustapha Timija' } }
const VISITEUR = { type: 'visiteur' }
const TOUS = ['photos', 'couleurs', 'champs', 'prix_zones']
const COMMENTAIRE = 'La photo de face est trop jaune, refaites-la.' // 45 caractères

function trouver(n: ReactNode, predicat: (e: ReactElement) => boolean): ReactElement | null {
  if (!isValidElement(n)) {
    if (!Array.isArray(n)) return null
    for (const enfant of n) {
      const r = trouver(enfant, predicat)
      if (r) return r
    }
    return null
  }
  if (predicat(n)) return n
  return trouver((n.props as { children?: ReactNode }).children, predicat)
}
const texte = (n: ReactNode): string =>
  Array.isArray(n)
    ? n.map(texte).join('')
    : isValidElement(n)
      ? texte((n.props as { children?: ReactNode }).children)
      : n == null || typeof n === 'boolean'
        ? ''
        : String(n)
const bandeau = (n: ReactNode) => trouver(n, (e) => (e.props as { role?: string }).role === 'status')

describe('règles pures de la curation', () => {
  it('liste de contrôle : quatre points exigés, valeurs inconnues ignorées', () => {
    expect(controlesCoches(['prix_zones', 'photos', 'inconnu', 'photos', 3])).toEqual(['photos', 'prix_zones'])
    expect(controlesCoches('photos')).toEqual([])
    expect(controleComplet(controlesCoches(TOUS))).toBe(true)
    expect(controleComplet(controlesCoches(TOUS.slice(1)))).toBe(false)
  })

  it('commentaire de renvoi : 10 à 1 000 caractères, espaces de bord retirés', () => {
    expect(validerCommentaire(`  ${COMMENTAIRE}  `)).toEqual({ ok: true, commentaire: COMMENTAIRE })
    expect(validerCommentaire('é'.repeat(1000))).toMatchObject({ ok: true })
    expect(validerCommentaire('Trop court')).toMatchObject({ ok: true })
    for (const invalide of ['', '   ', 'Trop cour', 'x'.repeat(9), 'x'.repeat(1001), null, 42]) {
      expect(validerCommentaire(invalide), String(invalide)).toMatchObject({ ok: false })
    }
    expect(validerCommentaire('Trop cour')).toEqual({ ok: false, erreur: 'Le commentaire doit faire au moins 10 caractères.' })
  })

  it('date d’accord : AAAA-MM-JJ à minuit UTC, vide = effacer ; future ou illisible refusée', () => {
    const maintenant = new Date('2026-11-04T10:00:00Z')
    expect(validerDateAccord('2026-11-04', maintenant)).toEqual({ ok: true, date: new Date('2026-11-04T00:00:00Z') })
    expect(validerDateAccord('', maintenant)).toEqual({ ok: true, date: null })
    expect(validerDateAccord(null, maintenant)).toEqual({ ok: true, date: null })
    // Le 5 novembre est déjà commencé quelque part (UTC+14) : accepté ; le 6, non.
    expect(validerDateAccord('2026-11-05', maintenant)).toMatchObject({ ok: true })
    expect(validerDateAccord('2026-11-06', maintenant)).toEqual({ ok: false, erreur: 'La date de signature ne peut pas être dans le futur.' })
    for (const illisible of ['2026-02-30', '04/11/2026', 'demain', '1999-12-31', 20261104]) {
      expect(validerDateAccord(illisible, maintenant), String(illisible)).toMatchObject({ ok: false })
    }
    expect(mentionAccord(new Date('2026-11-04T00:00:00Z'))).toBe('Accord signé le 4 novembre 2026')
    expect(mentionAccord(null)).toBe('Accord non signé')
    expect(dateAccordEnSaisie('2026-11-04T00:00:00.000Z')).toBe('2026-11-04')
  })
})

describe('base : curation par l’équipe', () => {
  let base: BaseJetable
  let db: Client

  const etat = async (slug: string) =>
    (
      await db.query(
        `SELECT publication::text AS publication, disponibilite::text AS disponibilite, "envoyeeEnCurationLe"
         FROM "Artwork" WHERE slug = $1`,
        [slug],
      )
    ).rows[0]
  const decisions = async () =>
    (
      await db.query(
        `SELECT a.slug, d.decision::text AS decision, d.commentaire, d.controle, d."adminId"
         FROM "DecisionCuration" d JOIN "Artwork" a ON a.id = d."artworkId" ORDER BY d."createdAt"`,
      )
    ).rows
  const accord = async (id = 'artiste-1') =>
    (await db.query(`SELECT "accordSigneLe"::text AS a FROM "Artist" WHERE id = $1`, [id])).rows[0].a as string | null
  const signer = (id = 'artiste-1') => db.query(`UPDATE "Artist" SET "accordSigneLe" = '2026-11-01' WHERE id = $1`, [id])

  /** Œuvre insérée directement dans l'état voulu (date d'envoi facultative). */
  async function oeuvre(slug: string, publication: string, envoyeeLe: string | null = null, artiste = 'artiste-1') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes",
                              "hauteurMm", "largeurMm", publication, disponibilite, "artistId",
                              "envoyeeEnCurationLe", "createdAt", "updatedAt")
       VALUES ($1, $1, $1, 2024, 'Huile', 'Histoire', 'https://res.cloudinary.com/x/image/upload/a.jpg',
               95000, 600, 800, $2::"Publication", 'disponible', $3, $4, now(), now())`,
      [slug, publication, artiste, envoyeeLe],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('admin-1', 'admin@exemple.test', 'admin', now())`)
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('utilisateur-1', 'mt@exemple.test', 'artist', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId")
       VALUES ('artiste-1', 'mustapha-timija', 'Mustapha Timija', 'MA', 1980, 'Bio', '', now(), 'utilisateur-1'),
              ('artiste-2', 'kara-walker', 'Kara Walker', 'US', 1969, 'Bio', '', now(), NULL)`,
    )
  })

  afterAll(async () => {
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = VISITEUR
    await db.query('DELETE FROM "Artwork"')
    await db.query('DELETE FROM "Zone"')
    await db.query(`UPDATE "Artist" SET "accordSigneLe" = NULL`)
  })

  describe('file', () => {
    it('ordre d’envoi (1er, 2, 3) ; brouillons et publiées absents ; artiste, date et accord', async () => {
      const { fileDeCuration } = await import('@/lib/curation')
      await oeuvre('envoyee-le-1', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('envoyee-le-3', 'en_curation', '2026-11-03T09:00:00Z', 'artiste-2')
      await oeuvre('envoyee-le-2', 'en_curation', '2026-11-02T09:00:00Z')
      await oeuvre('un-brouillon', 'brouillon')
      await oeuvre('une-publiee', 'publiee')
      await signer('artiste-1')

      const r = await fileDeCuration(ADMIN as never)
      if (!r.ok) throw new Error(r.code)
      expect(r.file.map((o) => o.slug)).toEqual(['envoyee-le-1', 'envoyee-le-2', 'envoyee-le-3'])
      expect(r.file[0]).toMatchObject({ artiste: { nom: 'Mustapha Timija' }, envoyeeLe: new Date('2026-11-01T09:00:00Z') })
      expect(r.file[0].accordSigneLe).not.toBeNull()
      expect(r.file[2]).toMatchObject({ artiste: { nom: 'Kara Walker' }, accordSigneLe: null })

      const { FileDeCuration } = await import('@/app/dashboard/admin/oeuvres/FileDeCuration')
      const html = renderToStaticMarkup(createElement(FileDeCuration, { file: r.file }))
      expect(html).toContain('Accord signé')
      expect(html).toContain('Accord non signé')
      expect(html).toContain('Envoyée le 1 novembre 2026')
      expect(html.indexOf('envoyee-le-1')).toBeLessThan(html.indexOf('envoyee-le-2'))
    })

    it('file vide : « Aucune œuvre à relire. » ; non admin : acces_refuse', async () => {
      const { fileDeCuration } = await import('@/lib/curation')
      const { FileDeCuration } = await import('@/app/dashboard/admin/oeuvres/FileDeCuration')
      expect(renderToStaticMarkup(createElement(FileDeCuration, { file: [] }))).toContain('Aucune œuvre à relire.')
      const enErreur = renderToStaticMarkup(createElement(FileDeCuration, { file: [], erreur: 'Réservé à l’équipe Errancy.' }))
      expect(enErreur).toContain('role="alert"')
      expect(enErreur).not.toContain('Aucune œuvre à relire.')
      expect(await fileDeCuration(ARTISTE as never)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await fileDeCuration(VISITEUR as never)).toEqual({ ok: false, code: 'acces_refuse' })
    })

    it('page des œuvres : file en tête, bandeau après une décision ; non admin redirigé', async () => {
      const { default: Page } = await import('@/app/dashboard/admin/oeuvres/page')
      const { FileDeCuration } = await import('@/app/dashboard/admin/oeuvres/FileDeCuration')
      await oeuvre('a-relire', 'en_curation', '2026-11-01T09:00:00Z')
      acteur.courant = ADMIN
      const page = await Page({ searchParams: Promise.resolve({ decision: 'validee' }) })
      const file = trouver(page, (e) => e.type === FileDeCuration)
      expect((file?.props as { file: { slug: string }[] }).file.map((o) => o.slug)).toEqual(['a-relire'])
      expect(texte(bandeau(page))).toMatch(/validée.*visible sur le site/)
      expect(bandeau(await Page({ searchParams: Promise.resolve({}) }))).toBeNull()

      acteur.courant = ARTISTE
      await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirection:/dashboard')
    })
  })

  describe('valider', () => {
    it('accord signé et liste cochée : publiee + disponible, décision enregistrée, visible sur le site', async () => {
      const { validerOeuvre } = await import('@/lib/curation')
      const { getAllArtworks, getArtworkBySlug } = await import('@/lib/catalogue')
      await oeuvre('a-valider', 'en_curation', '2026-11-01T09:00:00Z')
      await signer()
      expect((await getAllArtworks()).map((a) => a.id)).not.toContain('a-valider')

      expect(await validerOeuvre(ADMIN as never, 'a-valider', TOUS)).toEqual({ ok: true, slug: 'a-valider' })
      expect(await etat('a-valider')).toMatchObject({ publication: 'publiee', disponibilite: 'disponible' })
      expect(await decisions()).toEqual([
        { slug: 'a-valider', decision: 'valider', commentaire: null, controle: TOUS, adminId: 'admin-1' },
      ])
      expect((await getAllArtworks()).map((a) => a.id)).toContain('a-valider')
      expect(await getArtworkBySlug('a-valider')).toMatchObject({ id: 'a-valider', sold: false })
    })

    it('accord absent : accord_absent, rien n’est écrit', async () => {
      const { validerOeuvre } = await import('@/lib/curation')
      await oeuvre('sans-accord', 'en_curation', '2026-11-01T09:00:00Z')
      expect(await validerOeuvre(ADMIN as never, 'sans-accord', TOUS)).toEqual({ ok: false, code: 'accord_absent' })
      expect(await etat('sans-accord')).toMatchObject({ publication: 'en_curation' })
      expect(await decisions()).toEqual([])
    })

    it('liste de contrôle incomplète : controle_incomplet, rien n’est écrit', async () => {
      const { validerOeuvre } = await import('@/lib/curation')
      await oeuvre('controle', 'en_curation', '2026-11-01T09:00:00Z')
      await signer()
      for (const coches of [[], TOUS.slice(0, 3), 'photos', null]) {
        expect(await validerOeuvre(ADMIN as never, 'controle', coches)).toEqual({ ok: false, code: 'controle_incomplet' })
      }
      expect((await etat('controle')).publication).toBe('en_curation')
      expect(await decisions()).toEqual([])
    })

    it('double décision, brouillon, publiée ou inconnue : refus', async () => {
      const { validerOeuvre, renvoyerOeuvre } = await import('@/lib/curation')
      await oeuvre('deux-fois', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('renvoyee', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('brouillon', 'brouillon')
      await signer()
      expect((await validerOeuvre(ADMIN as never, 'deux-fois', TOUS)).ok).toBe(true)
      expect(await validerOeuvre(ADMIN as never, 'deux-fois', TOUS)).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await renvoyerOeuvre(ADMIN as never, 'deux-fois', COMMENTAIRE)).toEqual({ ok: false, code: 'transition_interdite' })
      expect((await renvoyerOeuvre(ADMIN as never, 'renvoyee', COMMENTAIRE)).ok).toBe(true)
      expect(await renvoyerOeuvre(ADMIN as never, 'renvoyee', COMMENTAIRE)).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await validerOeuvre(ADMIN as never, 'renvoyee', TOUS)).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await validerOeuvre(ADMIN as never, 'brouillon', TOUS)).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await validerOeuvre(ADMIN as never, 'inconnue', TOUS)).toEqual({ ok: false, code: 'introuvable' })
      expect(await etat('deux-fois')).toMatchObject({ publication: 'publiee' })
      expect(await etat('renvoyee')).toMatchObject({ publication: 'brouillon' })
      expect((await decisions()).map((d) => d.decision)).toEqual(['valider', 'renvoyer'])
    })

    it('disponibilité autre que disponible : indisponible (l’axe n’est pas écrit par curation)', async () => {
      const { validerOeuvre } = await import('@/lib/curation')
      await oeuvre('retiree', 'en_curation', '2026-11-01T09:00:00Z')
      await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'retiree'`)
      await signer()
      expect(await validerOeuvre(ADMIN as never, 'retiree', TOUS)).toEqual({ ok: false, code: 'indisponible' })
      expect((await etat('retiree')).publication).toBe('en_curation')
    })
  })

  describe('renvoyer', () => {
    it('commentaire de 45 caractères : brouillon, décision enregistrée avec les points cochés, bandeau sur la fiche de dépôt', async () => {
      const { renvoyerOeuvre, lireDepot } = await import('@/lib/curation')
      await oeuvre('a-renvoyer', 'en_curation', '2026-11-01T09:00:00Z')
      expect(await renvoyerOeuvre(ADMIN as never, 'a-renvoyer', `  ${COMMENTAIRE} `, ['photos', 'champs'])).toEqual({
        ok: true,
        slug: 'a-renvoyer',
      })
      expect(await etat('a-renvoyer')).toMatchObject({ publication: 'brouillon', disponibilite: 'disponible' })
      expect(await decisions()).toEqual([
        { slug: 'a-renvoyer', decision: 'renvoyer', commentaire: COMMENTAIRE, controle: ['photos', 'champs'], adminId: 'admin-1' },
      ])

      const lu = await lireDepot(ARTISTE as never, 'a-renvoyer')
      if (!lu.ok) throw new Error(lu.code)
      expect(lu.depot.renvoi).toMatchObject({ commentaire: COMMENTAIRE })

      acteur.courant = ARTISTE
      const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
      const { PageDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/PageDepot')
      const page = await Page({ params: Promise.resolve({ slug: 'a-renvoyer' }) })
      expect(page.type).toBe(PageDepot)
      const rendu = PageDepot(page.props)
      expect(texte(bandeau(rendu))).toContain(COMMENTAIRE)
      expect(texte(bandeau(rendu))).toMatch(/renvoyé cette œuvre le \d+ \S+ 2026/)
    })

    it('commentaire vide ou trop court : commentaire_invalide avec le message du champ, rien n’est écrit', async () => {
      const { renvoyerOeuvre } = await import('@/lib/curation')
      await oeuvre('court', 'en_curation', '2026-11-01T09:00:00Z')
      expect(await renvoyerOeuvre(ADMIN as never, 'court', '')).toMatchObject({ ok: false, code: 'commentaire_invalide', erreur: expect.any(String) })
      expect(await renvoyerOeuvre(ADMIN as never, 'court', 'Refaire.')).toMatchObject({
        ok: false,
        code: 'commentaire_invalide',
        erreur: 'Le commentaire doit faire au moins 10 caractères.',
      })
      expect((await etat('court')).publication).toBe('en_curation')
      expect(await decisions()).toEqual([])
    })

    it('brouillon sans renvoi : aucun bandeau', async () => {
      const { lireDepot } = await import('@/lib/curation')
      await oeuvre('jamais-envoyee', 'brouillon')
      const lu = await lireDepot(ARTISTE as never, 'jamais-envoyee')
      if (!lu.ok) throw new Error(lu.code)
      expect(lu.depot.renvoi).toBeNull()
      const { PageDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/PageDepot')
      expect(bandeau(PageDepot({ depot: lu.depot, zones: [] }))).toBeNull()
    })
  })

  it('renvoyée, corrigée puis renvoyée en curation : dans la file avec sa nouvelle date, bandeau disparu', async () => {
    const { enregistrerChamp, enregistrerOffreDepot, envoyerEnCuration, fileDeCuration, oeuvreACurer, renvoyerOeuvre, lireDepot } =
      await import('@/lib/curation')
    // Dépôt complet par l'artiste (zones, champs, photos), comme en story 2.6.
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('z-maroc', 'Maroc', now())`)
    const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Aller retour')
    if (!r.ok) throw new Error(r.code)
    const slug = r.depot.slug
    const champs = [
      ['technique', 'Huile'], ['annee', '2024'], ['histoire', 'Une histoire.'], ['ambiance', 'calme'], ['hauteur', '60'],
      ['largeur', '80'], ['couleurDominante', 'bleu'], ['prix', '950'], ['visitesAtelier', 'non'],
      ['engagementCertificat', 'oui'], ['engagementEmballage', 'oui'], ['engagementReprise', 'oui'],
    ] as const
    for (const [champ, valeur] of champs) expect((await enregistrerChamp(ARTISTE as never, slug, champ, valeur)).ok, champ).toBe(true)
    const { id } = (await db.query('SELECT id FROM "Artwork" WHERE slug = $1', [slug])).rows[0]
    for (const type of ['face_lumiere_du_jour', 'gros_plan', 'mise_en_situation']) {
      await db.query(
        `INSERT INTO "PhotoOeuvre" (id, "artworkId", type, url, "publicId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2::"TypePhoto", 'https://res.cloudinary.com/x/image/upload/a.jpg', $3, now())`,
        [id, type, `errancy/oeuvres/${id}/${type}`],
      )
    }
    const offre = { nonLivree: false, frais: '25', preparation: '3', transportMin: '2', transportMax: '5' }
    expect((await enregistrerOffreDepot(ARTISTE as never, slug, 'z-maroc', offre)).ok).toBe(true)

    expect((await envoyerEnCuration(ARTISTE as never, slug)).ok).toBe(true)
    const premierEnvoi = (await etat(slug)).envoyeeEnCurationLe as Date
    expect((await renvoyerOeuvre(ADMIN as never, slug, COMMENTAIRE)).ok).toBe(true)
    const file1 = await fileDeCuration(ADMIN as never)
    expect(file1.ok && file1.file).toEqual([])

    // L'artiste lit le renvoi, corrige un champ et renvoie.
    const lu = await lireDepot(ARTISTE as never, slug)
    expect(lu.ok && lu.depot.renvoi?.commentaire).toBe(COMMENTAIRE)
    expect((await enregistrerChamp(ARTISTE as never, slug, 'histoire', 'Une histoire corrigée.')).ok).toBe(true)
    const encore = await lireDepot(ARTISTE as never, slug)
    expect(encore.ok && encore.depot.renvoi?.commentaire).toBe(COMMENTAIRE)
    expect((await envoyerEnCuration(ARTISTE as never, slug)).ok).toBe(true)
    // Story 3.4 : envoi, renvoi puis nouvel envoi écrivent chacun PublicationChangee (ids seulement) ;
    // story 4.1 : le renvoi écrit en plus OeuvreRenvoyee (pour l'e-mail de l'artiste).
    const evenements = (await db.query(`SELECT nom, charge FROM "Evenement" WHERE charge->>'artworkId' = $1 AND nom = 'PublicationChangee'`, [id])).rows
    expect(evenements).toEqual(Array(3).fill({ nom: 'PublicationChangee', charge: { artworkId: id, artistId: ARTISTE.artiste.id } }))
    const renvois = (await db.query(`SELECT charge FROM "Evenement" WHERE charge->>'artworkId' = $1 AND nom = 'OeuvreRenvoyee'`, [id])).rows
    expect(renvois).toEqual([{ charge: { decisionId: expect.any(String), artworkId: id, artistId: ARTISTE.artiste.id } }])

    const file2 = await fileDeCuration(ADMIN as never)
    if (!file2.ok) throw new Error(file2.code)
    expect(file2.file.map((o) => o.slug)).toEqual([slug])
    expect(file2.file[0].envoyeeLe!.getTime()).toBeGreaterThan(premierEnvoi.getTime())
    const vue = await oeuvreACurer(ADMIN as never, slug)
    expect(vue.ok && vue.oeuvre).toMatchObject({
      histoire: 'Une histoire corrigée.',
      renvoi: null,
      dernierRenvoiEquipe: { commentaire: COMMENTAIRE },
    })
    const { PageCuration } = await import('@/app/dashboard/admin/oeuvres/[slug]/PageCuration')
    if (!vue.ok) throw new Error(vue.code)
    expect(texte(PageCuration({ oeuvre: vue.oeuvre }))).toMatch(new RegExp(`Renvoyée à l.artiste le \\d+ \\S+ 2026 avec ce commentaire :.*${COMMENTAIRE}`))

    // Côté artiste : récapitulatif en lecture seule, sans bandeau de renvoi.
    acteur.courant = ARTISTE
    const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
    const { RecapitulatifCuration } = await import('@/app/dashboard/artiste/oeuvres/depot/RecapitulatifCuration')
    const page = await Page({ params: Promise.resolve({ slug }) })
    expect(page.type).toBe(RecapitulatifCuration)
    expect(renderToStaticMarkup(page)).not.toContain(COMMENTAIRE)
  })

  describe('page de curation', () => {
    it('œuvre en curation : récapitulatif (photos en grand), accord, liste de contrôle ; sinon ancienne page', async () => {
      const { default: Page } = await import('@/app/dashboard/admin/oeuvres/[slug]/page')
      const { PageCuration } = await import('@/app/dashboard/admin/oeuvres/[slug]/PageCuration')
      const { DecisionCuration } = await import('@/app/dashboard/admin/oeuvres/[slug]/DecisionCuration')
      const { RecapitulatifOeuvre } = await import('@/components/dashboard/RecapitulatifOeuvre')
      const { ArtworkForm } = await import('@/components/dashboard/ArtworkForm')
      await oeuvre('en-relecture', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('deja-publiee', 'publiee')
      await db.query(`UPDATE "Artist" SET "accordSigneLe" = '2026-11-04' WHERE id = 'artiste-1'`)
      const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

      acteur.courant = ADMIN
      const page = await Page(params('en-relecture'))
      expect(page.type).toBe(PageCuration)
      const rendu = PageCuration(page.props)
      expect(texte(rendu)).toContain('Accord signé le 4 novembre 2026')
      expect(texte(rendu)).toContain('Mustapha Timija')
      expect(trouver(rendu, (e) => e.type === DecisionCuration)?.props).toEqual({ slug: 'en-relecture', accordSigne: true })
      const recap = trouver(rendu, (e) => e.type === RecapitulatifOeuvre)
      expect(recap?.props).toMatchObject({ photosEnGrand: true })
      const html = renderToStaticMarkup(recap!)
      expect(html).toContain('950\u202f€')
      expect(html).not.toMatch(/<(input|textarea|select|form)\b/)

      const ancienne = await Page(params('deja-publiee'))
      expect(trouver(ancienne, (e) => e.type === ArtworkForm)).not.toBeNull()

      acteur.courant = ARTISTE
      await expect(Page(params('en-relecture'))).rejects.toThrow('redirection:/dashboard')
    })
  })

  describe('non admin', () => {
    it('artiste ou visiteur : acces_refuse, rien n’est écrit', async () => {
      const { validerOeuvre, renvoyerOeuvre, oeuvreACurer, enregistrerAccord } = await import('@/lib/curation')
      await oeuvre('protegee', 'en_curation', '2026-11-01T09:00:00Z')
      await signer()
      for (const qui of [ARTISTE, VISITEUR, { type: 'user', userId: 'u' }]) {
        expect(await validerOeuvre(qui as never, 'protegee', TOUS)).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await renvoyerOeuvre(qui as never, 'protegee', COMMENTAIRE)).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await oeuvreACurer(qui as never, 'protegee')).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await enregistrerAccord(qui as never, 'artiste-2', '2026-11-04')).toEqual({ ok: false, code: 'acces_refuse' })
      }
      expect((await etat('protegee')).publication).toBe('en_curation')
      expect(await decisions()).toEqual([])
      expect(await accord('artiste-2')).toBeNull()
    })

    it('actions serveur : refus sans écriture pour un artiste ; redirection vers la file pour l’admin', async () => {
      const { actionValider, actionRenvoyer } = await import('@/app/dashboard/admin/oeuvres/actions')
      await oeuvre('par-action', 'en_curation', '2026-11-01T09:00:00Z')
      await signer()
      const formulaire = (champs: [string, string][]) => {
        const f = new FormData()
        for (const [k, v] of champs) f.append(k, v)
        return f
      }
      acteur.courant = ARTISTE
      expect(await actionValider('par-action', null, formulaire(TOUS.map((c) => ['controle', c])))).toMatchObject({
        ok: false,
        code: 'acces_refuse',
      })
      acteur.courant = ADMIN
      expect(await actionRenvoyer('par-action', null, formulaire([['commentaire', 'court']]))).toMatchObject({
        ok: false,
        code: 'commentaire_invalide',
        erreurCommentaire: 'Le commentaire doit faire au moins 10 caractères.',
      })
      expect(await actionValider('par-action', null, formulaire([['controle', 'photos']]))).toMatchObject({
        ok: false,
        code: 'controle_incomplet',
      })
      await expect(actionValider('par-action', null, formulaire(TOUS.map((c) => ['controle', c])))).rejects.toThrow(
        'redirection:/dashboard/admin/oeuvres?decision=validee',
      )
      expect((await etat('par-action')).publication).toBe('publiee')
    })
  })

  describe('accord signé', () => {
    it('2026-11-04 sur Mustapha Timija : « Accord signé le 4 novembre 2026 » ; effacé ; future ou illisible refusée', async () => {
      const { enregistrerAccord } = await import('@/lib/curation')
      const { actionEnregistrerAccord } = await import('@/app/dashboard/admin/artistes/actions')
      expect(await enregistrerAccord(ADMIN as never, 'artiste-1', '2026-11-04')).toEqual({
        ok: true,
        accordSigneLe: new Date('2026-11-04T00:00:00Z'),
      })
      expect(mentionAccord(await accord())).toBe('Accord signé le 4 novembre 2026')

      const futur = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      expect(await enregistrerAccord(ADMIN as never, 'artiste-1', futur)).toEqual({
        ok: false,
        code: 'date_invalide',
        erreur: 'La date de signature ne peut pas être dans le futur.',
      })
      expect(await enregistrerAccord(ADMIN as never, 'artiste-1', '2026-02-30')).toMatchObject({ ok: false, code: 'date_invalide' })
      expect(mentionAccord(await accord())).toBe('Accord signé le 4 novembre 2026')
      expect(await enregistrerAccord(ADMIN as never, 'inconnu', '2026-11-04')).toEqual({ ok: false, code: 'introuvable' })

      acteur.courant = ADMIN
      const effacer = new FormData()
      effacer.append('effacer', '1')
      expect(await actionEnregistrerAccord('artiste-1', null, effacer)).toEqual({ ok: true, message: 'Date de signature effacée.' })
      expect(await accord()).toBeNull()
      await enregistrerAccord(ADMIN as never, 'artiste-1', '2026-11-04')
      expect(await actionEnregistrerAccord('artiste-1', null, new FormData())).toEqual({ ok: false, message: 'Choisissez une date.' })
      const vide = new FormData()
      vide.append('date', '  ')
      expect(await actionEnregistrerAccord('artiste-1', null, vide)).toEqual({ ok: false, message: 'Choisissez une date.' })
      expect(await accord()).toBe('2026-11-04')
      const illisible = new FormData()
      illisible.append('date', 'demain')
      expect(await actionEnregistrerAccord('artiste-1', null, illisible)).toMatchObject({ ok: false, message: expect.stringMatching(/illisible/) })
    })

    it('page des artistes : accord affiché pour chaque artiste', async () => {
      const { default: Page } = await import('@/app/dashboard/admin/artistes/page')
      const { AccordArtiste } = await import('@/app/dashboard/admin/artistes/AccordArtiste')
      await db.query(`UPDATE "Artist" SET "accordSigneLe" = '2026-11-04' WHERE id = 'artiste-1'`)
      acteur.courant = ADMIN
      const page = await Page()
      const props: { artistId: string; accordSigneLe: string | null }[] = []
      trouver(page, (e) => {
        if (e.type === AccordArtiste) props.push(e.props as never)
        return false
      })
      expect(props).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artistId: 'artiste-1', accordSigneLe: '2026-11-04T00:00:00.000Z' }),
          expect.objectContaining({ artistId: 'artiste-2', accordSigneLe: null }),
        ]),
      )
    })
  })

  it('bascule historique definirPublication : refuse une œuvre en curation, publie encore une œuvre hors curation', async () => {
    const { definirPublication } = await import('@/lib/curation')
    await oeuvre('en-file', 'en_curation', '2026-11-01T09:00:00Z')
    await oeuvre('historique', 'publiee')
    expect(await definirPublication(ADMIN as never, 'en-file', true)).toEqual({ ok: false, code: 'transition_interdite' })
    expect(await definirPublication(ADMIN as never, 'en-file', false)).toEqual({ ok: false, code: 'transition_interdite' })
    expect((await etat('en-file')).publication).toBe('en_curation')
    expect(await definirPublication(ADMIN as never, 'historique', false)).toEqual({ ok: true })
    expect((await etat('historique')).publication).toBe('brouillon')

    const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')
    acteur.courant = ADMIN
    const req = new Request('http://local/api/admin/oeuvres/en-file', { method: 'PUT', body: JSON.stringify({ publiee: true }) })
    const rep = await PUT(req as never, { params: Promise.resolve({ slug: 'en-file' }) })
    expect(rep.status).toBe(409)
    expect((await rep.json()).error).toMatch(/file de curation/)
  })
  describe('bascule historique : publier exige l’accord signé et une validation pour une œuvre déposée', () => {
    const photo = (slug: string) =>
      db.query(
        `INSERT INTO "PhotoOeuvre" (id, "artworkId", type, url, "publicId", "updatedAt")
         SELECT gen_random_uuid()::text, id, 'gros_plan', 'https://res.cloudinary.com/x/image/upload/a.jpg', 'p', now()
         FROM "Artwork" WHERE slug = $1`,
        [slug],
      )

    it('brouillon de dépôt, œuvre renvoyée ou sans accord : refus ; validée puis dépubliée : republiable', async () => {
      const { definirPublication, renvoyerOeuvre, validerOeuvre, basculesPublication } = await import('@/lib/curation')
      await oeuvre('ancienne', 'brouillon')
      await oeuvre('depot-photo', 'brouillon')
      await photo('depot-photo')
      await oeuvre('renvoyee', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('validee', 'en_curation', '2026-11-01T09:00:00Z')
      await oeuvre('publiee', 'publiee')

      // Sans accord : rien ne se publie, même une œuvre hors dépôt.
      expect(await definirPublication(ADMIN as never, 'ancienne', true)).toEqual({ ok: false, code: 'accord_absent' })
      await signer()
      expect((await renvoyerOeuvre(ADMIN as never, 'renvoyee', COMMENTAIRE)).ok).toBe(true)
      expect((await validerOeuvre(ADMIN as never, 'validee', TOUS)).ok).toBe(true)

      expect(await definirPublication(ADMIN as never, 'depot-photo', true)).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await definirPublication(ADMIN as never, 'renvoyee', true)).toEqual({ ok: false, code: 'transition_interdite' })
      expect((await etat('depot-photo')).publication).toBe('brouillon')
      expect((await etat('renvoyee')).publication).toBe('brouillon')

      // Dépublier reste permis ; une œuvre validée en dernier lieu se republie.
      expect(await definirPublication(ADMIN as never, 'validee', false)).toEqual({ ok: true })
      expect(await definirPublication(ADMIN as never, 'validee', true)).toEqual({ ok: true })
      expect(await definirPublication(ADMIN as never, 'ancienne', true)).toEqual({ ok: true })
      expect((await etat('ancienne')).publication).toBe('publiee')

      await oeuvre('en-file', 'en_curation', '2026-11-02T09:00:00Z')
      const slugs = ['ancienne', 'depot-photo', 'renvoyee', 'validee', 'publiee', 'en-file']
      expect([...(await basculesPublication(ADMIN as never, slugs))].sort()).toEqual(['ancienne', 'publiee', 'validee'])
      expect((await basculesPublication(ARTISTE as never, slugs)).size).toBe(0)

      // Sans accord, une œuvre publiée garde la bascule (dépublier), une œuvre non publiée la perd.
      await db.query(`UPDATE "Artist" SET "accordSigneLe" = NULL`)
      await definirPublication(ADMIN as never, 'ancienne', false)
      expect([...(await basculesPublication(ADMIN as never, slugs))].sort()).toEqual(['publiee', 'validee'])
    })

    it('route admin : 409 avec le message de l’accord absent', async () => {
      const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')
      await oeuvre('sans-accord-put', 'brouillon')
      acteur.courant = ADMIN
      const req = new Request('http://local/api/admin/oeuvres/sans-accord-put', { method: 'PUT', body: JSON.stringify({ publiee: true }) })
      const rep = await PUT(req as never, { params: Promise.resolve({ slug: 'sans-accord-put' }) })
      expect(rep.status).toBe(409)
      expect((await rep.json()).error).toMatch(/accord écrit signé/)
      expect((await etat('sans-accord-put')).publication).toBe('brouillon')
    })
  })

  it('CHECK en base : un renvoi exige un commentaire de 10 à 1 000 caractères ; controle jamais NULL', async () => {
    await oeuvre('check', 'brouillon')
    const { id } = (await db.query(`SELECT id FROM "Artwork" WHERE slug = 'check'`)).rows[0]
    const inserer = (decision: string, commentaire: string | null) =>
      db.query(
        `INSERT INTO "DecisionCuration" (id, "artworkId", decision, commentaire) VALUES (gen_random_uuid()::text, $1, $2::"TypeDecisionCuration", $3)`,
        [id, decision, commentaire],
      )
    for (const invalide of [null, 'court', 'x'.repeat(1001)]) {
      await expect(inserer('renvoyer', invalide), String(invalide)).rejects.toThrow(/DecisionCuration_renvoi_commente/)
    }
    await inserer('renvoyer', 'é'.repeat(1000))
    await inserer('valider', null)
    await expect(
      db.query(`INSERT INTO "DecisionCuration" (id, "artworkId", decision, controle) VALUES ('n', $1, 'valider', NULL)`, [id]),
    ).rejects.toThrow(/null/i)
    expect((await db.query(`SELECT controle FROM "DecisionCuration" WHERE decision = 'valider'`)).rows[0].controle).toEqual([])
  })

  describe('décisions concurrentes (ligne verrouillée)', () => {
    it('valider et renvoyer en même temps : une seule décision réussit et une seule est enregistrée', async () => {
      const { validerOeuvre, renvoyerOeuvre } = await import('@/lib/curation')
      await signer()
      for (let i = 0; i < 10; i++) {
        const slug = `course-${i}`
        await oeuvre(slug, 'en_curation', '2026-11-01T09:00:00Z')
        const resultats = await Promise.all([
          validerOeuvre(ADMIN as never, slug, TOUS),
          renvoyerOeuvre(ADMIN as never, slug, COMMENTAIRE),
        ])
        expect(resultats.filter((r) => r.ok)).toHaveLength(1)
        expect(resultats.filter((r) => !r.ok)).toEqual([{ ok: false, code: 'transition_interdite' }])
        const lignes = (await decisions()).filter((d) => d.slug === slug)
        expect(lignes).toHaveLength(1)
        expect((await etat(slug)).publication).toBe(lignes[0].decision === 'valider' ? 'publiee' : 'brouillon')
      }
    })

    it('valider et effacer l’accord en même temps : jamais publiée sans accord, sauf validation passée avant', async () => {
      const { validerOeuvre, enregistrerAccord } = await import('@/lib/curation')
      for (let i = 0; i < 10; i++) {
        const slug = `accord-${i}`
        await signer()
        await oeuvre(slug, 'en_curation', '2026-11-01T09:00:00Z')
        const [validation, effacement] = await Promise.all([
          validerOeuvre(ADMIN as never, slug, TOUS),
          enregistrerAccord(ADMIN as never, 'artiste-1', ''),
        ])
        expect(effacement).toEqual({ ok: true, accordSigneLe: null })
        expect(await accord()).toBeNull()
        const publiee = (await etat(slug)).publication === 'publiee'
        if (validation.ok) {
          // Validation passée avant l'effacement (verrou de la ligne artiste) : publiée, une décision.
          expect(publiee).toBe(true)
          expect((await decisions()).filter((d) => d.slug === slug)).toHaveLength(1)
        } else {
          expect(validation).toEqual({ ok: false, code: 'accord_absent' })
          expect(publiee).toBe(false)
          expect((await decisions()).filter((d) => d.slug === slug)).toHaveLength(0)
        }
      }
    })
  })
})
