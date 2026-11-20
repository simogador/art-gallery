import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 8.5 (FR-30, FR-15, AD-9, AD-10, AD-15, AD-16) : réclamation et retour. Base réelle ; envoi simulé (aucun vrai
// e-mail ni appel à Cloudinary). Signalement dans le délai, photos revérifiées, rejeu et appuis simultanés (une
// seule réclamation, un seul événement), décision de l'équipe, retour reçu et remboursement borné par l'allocation,
// accès (admin seulement, artiste jamais), aucune promesse ni donnée personnelle dans les e-mails.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[] }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
const cookie = vi.hoisted(() => ({ suivi: undefined as string | undefined }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: (nom: string) => (nom === 'suivi' && cookie.suivi ? { value: cookie.suivi } : undefined) }), headers: () => ({ get: () => null }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  usePathname: () => '/dashboard/artiste/commandes',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (cible: string) => {
    throw new Error(`NEXT_REDIRECT:${cible}`)
  },
}))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      envoi.envoyes.push(c)
      return { ok: true }
    },
  }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const ARTISTE_A = { type: 'artist', userId: 'user-a', artiste: { id: 'art-a', slug: 'art-a', name: 'Artiste A' } } as never
const ARTISTE_B = { type: 'artist', userId: 'user-b', artiste: { id: 'art-b', slug: 'art-b', name: 'Artiste B' } } as never
const EMAIL_ACHETEUR = 'claire.martin@exemple.test'
const NOM_ACHETEUR = 'Claire Martin-Dupont'
const ADRESSE = '12 rue des Lilas\n75011 Paris'
const TELEPHONE = '+33 6 12 34 56 78'
const DESCRIPTION = 'Le cadre est fendu sur le côté gauche et la toile porte une marque.'
const SECRET = 'secret-de-test'
const CLOUD = 'nuage-de-test'
const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

/** Réponse de Cloudinary telle que l'enverrait le navigateur, signée comme le fait Cloudinary. */
function reponsePhoto(publicId: string, surcharge: Record<string, unknown> = {}, version = '1234567890') {
  const signature = createHash('sha1').update(`public_id=${publicId}&version=${version}${SECRET}`).digest('hex')
  return {
    public_id: publicId,
    version,
    signature,
    secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v${version}/${publicId}.jpg`,
    resource_type: 'image',
    format: 'jpg',
    bytes: 200000,
    width: 800,
    height: 600,
    ...surcharge,
  }
}

describe('sans base : règles pures', () => {
  it('validerReclamation : motif de la liste fermée, description non vide de 1 000 caractères au plus, 3 photos au plus', async () => {
    const { validerReclamation } = await import('@/lib/commandes/reclamation-regles')
    expect(validerReclamation({ motif: 'abimee', description: `  ${DESCRIPTION}  ` }, 0)).toEqual({ ok: true, motif: 'abimee', description: DESCRIPTION })
    expect(validerReclamation({ motif: 'changement_avis', description: 'x'.repeat(10) }, 3)).toMatchObject({ ok: true })
    expect(validerReclamation({ motif: 'autre', description: 'x'.repeat(10) }, 0)).toEqual({ ok: false, erreurs: { motif: 'invalide' } })
    expect(validerReclamation({ motif: 'abimee', description: '   ' }, 0)).toEqual({ ok: false, erreurs: { description: 'requis' } })
    expect(validerReclamation({ motif: 'abimee', description: 'x'.repeat(1001) }, 0)).toEqual({ ok: false, erreurs: { description: 'trop_long' } })
    expect(validerReclamation({ motif: 'abimee', description: 'x'.repeat(1000) }, 0)).toMatchObject({ ok: true })
    expect(validerReclamation({ motif: 'abimee', description: 'x'.repeat(10) }, 4)).toEqual({ ok: false, erreurs: { photos: 'trop' } })
    expect(validerReclamation({ motif: 'abimee', description: 'x'.repeat(9) }, 0)).toEqual({ ok: false, erreurs: { description: 'trop_court' } })
    expect(validerReclamation(null, 0)).toMatchObject({ ok: false, erreurs: { motif: 'invalide', description: 'requis' } })
  })

  it('délai de retour : échu à la borne incluse ; sans date, échu ; le bouton exige livrée, délai ouvert et aucune réclamation', async () => {
    const { delaiRetourEchu, peutSignalerProbleme } = await import('@/lib/commandes/reclamation-regles')
    const fin = new Date('2026-12-04T10:00:00Z')
    expect(delaiRetourEchu(fin, new Date('2026-12-04T09:59:59Z'))).toBe(false)
    expect(delaiRetourEchu(fin, new Date('2026-12-04T10:00:00Z'))).toBe(true)
    expect(delaiRetourEchu(null)).toBe(true)
    expect(delaiRetourEchu(new Date('invalide'))).toBe(true)
    const avant = new Date('2026-12-01T10:00:00Z')
    expect(peutSignalerProbleme({ etat: 'livree', retourAvant: fin, aReclamation: false }, avant)).toBe(true)
    expect(peutSignalerProbleme({ etat: 'livree', retourAvant: fin, aReclamation: true }, avant)).toBe(false)
    expect(peutSignalerProbleme({ etat: 'expediee', retourAvant: fin, aReclamation: false }, avant)).toBe(false)
    expect(peutSignalerProbleme({ etat: 'retournee', retourAvant: fin, aReclamation: false }, avant)).toBe(false)
    expect(peutSignalerProbleme({ etat: 'livree', retourAvant: fin, aReclamation: false }, new Date('2026-12-05T00:00:00Z'))).toBe(false)
  })

  it('montantRemboursable : entier strictement positif, jamais au-delà de l’allocation', async () => {
    const { montantRemboursable } = await import('@/lib/commandes/reclamation-regles')
    expect(montantRemboursable(100, 100)).toBe(true)
    expect(montantRemboursable(1, 100)).toBe(true)
    expect(montantRemboursable(101, 100)).toBe(false)
    expect(montantRemboursable(0, 100)).toBe(false)
    expect(montantRemboursable(-5, 100)).toBe(false)
    expect(montantRemboursable(10.5, 100)).toBe(false)
    expect(montantRemboursable('10', 100)).toBe(false)
  })

  it('transitions : livree → retournee seulement ; rien ne sort de retournee', async () => {
    const { transitionPermise, ETATS_COMMANDE } = await import('@/lib/commandes/etats')
    expect(ETATS_COMMANDE).toContain('retournee')
    expect(transitionPermise('livree', 'retournee')).toBe(true)
    for (const de of ['en_attente_paiement', 'confirmee', 'prise_en_charge', 'expediee', 'annulee', 'historique', 'retournee'] as const) expect(transitionPermise(de, 'retournee'), de).toBe(false)
    for (const vers of ['livree', 'confirmee', 'expediee', 'annulee'] as const) expect(transitionPermise('retournee', vers), vers).toBe(false)
  })

  it('événements : charges = un identifiant seulement ; reliés aux e-mails, le retour reçu seulement relaté', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(evenementValide({ nom: 'ReclamationOuverte', charge: { reclamationId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'ReclamationOuverte', charge: { reclamationId: 'x', description: 'y' } })).toBe(false)
    expect(evenementValide({ nom: 'ReclamationTraitee', charge: { reclamationId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeRetournee', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeRetournee', charge: { commandeId: 'x', montant: 1 } })).toBe(false)
    expect(ABONNEMENTS.ReclamationOuverte.map((a) => a.nom)).toEqual(['alerterEquipeReclamation'])
    expect(ABONNEMENTS.ReclamationTraitee.map((a) => a.nom)).toEqual(['envoyerDecisionReclamation', 'envoyerRetourAccepteArtiste'])
    expect(ABONNEMENTS.CommandeRetournee).toEqual([])
  })

  it('frise : « Retournée » datée après « Livrée »', async () => {
    const { construireFrise } = await import('@/lib/commandes/suivi-regles')
    const d = (j: number) => new Date(`2026-11-${j}T10:00:00Z`)
    const frise = construireFrise({
      etat: 'retournee', creeeLe: d(10), constateLe: d(11), delaiMinJours: 5, delaiMaxJours: 9,
      priseEnChargeLe: d(12), expedieeLe: d(13), transporteur: 'DHL', numeroSuivi: 'AB12', livreeLe: d(20), retourRecuLe: d(25),
    })
    expect(frise.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'expediee', 'livree', 'retournee'])
    expect(frise[5]).toMatchObject({ faite: true, date: d(25) })
  })

  it('la migration est additive : valeur avant `annulee`, deux colonnes, deux tables, aucune donnée touchée', () => {
    const sql = readFileSync('prisma/migrations/20261127090000_reclamation/migration.sql', 'utf8')
    expect(sql).toContain(`ADD VALUE 'retournee' BEFORE 'annulee'`)
    for (const m of ['"retourRecuLe"', '"retourRecuPar"', 'CREATE TABLE "Reclamation"', 'CREATE TABLE "PhotoReclamation"', '"Reclamation_commandeId_key"']) expect(sql).toContain(m)
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|DROP)\b/m)
  })

  it('dictionnaire : aucune durée, gratuité, frais ni promesse de remboursement dans les textes de réclamation', () => {
    const textes = JSON.stringify([
      fr.suivi.reclamation,
      fr.courriels.commande.reclamationAcceptee,
      fr.courriels.commande.reclamationRefusee,
      fr.courriels.commande.retourArtiste,
      fr.courriels.commande.alerteReclamation,
      fr.courriels.commande.livraison,
    ])
    expect(textes).not.toMatch(/gratuit|garanti|frais|\d+ jours|sous \d|avoir|devise/i)
    // Ni durée ni promesse de remboursement dans les e-mails.
    expect(JSON.stringify([fr.courriels.commande.reclamationAcceptee, fr.courriels.commande.reclamationRefusee, fr.courriels.commande.retourArtiste, fr.courriels.commande.livraison])).not.toMatch(/rembours/i)
  })

  describe('photos : signature et revérification', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', CLOUD)
      vi.stubEnv('CLOUDINARY_API_KEY', 'cle-de-test')
      vi.stubEnv('CLOUDINARY_API_SECRET', SECRET)
    })
    afterEach(() => vi.unstubAllEnvs())

    it('signerEnvoiPhoto : public_id imposé sous le dossier de la commande ; sans configuration, null', async () => {
      const { signerEnvoiPhoto } = await import('@/lib/commandes/photos-reclamation')
      const e = signerEnvoiPhoto('cmd-1')
      expect(e?.publicId).toMatch(/^errancy\/reclamations\/cmd-1\/photo-[0-9a-f]{8}$/)
      expect(e?.allowedFormats).toBe('jpg,jpeg,png,webp,heic,heif')
      expect(e?.signature).toMatch(/^[0-9a-f]{40}$/)
      vi.stubEnv('CLOUDINARY_API_SECRET', '')
      expect(signerEnvoiPhoto('cmd-1')).toBeNull()
    })

    it('verifierPhotos : accepte des réponses authentiques ; refuse signature fausse, autre commande, autre format, poids, doublon, 4 photos', async () => {
      const { verifierPhotos } = await import('@/lib/commandes/photos-reclamation')
      const id = (n: string) => `errancy/reclamations/cmd-1/photo-${n}`
      const bonne = reponsePhoto(id('aaaaaaaa'))
      expect(verifierPhotos('cmd-1', [])).toEqual({ ok: true, photos: [] })
      expect(verifierPhotos('cmd-1', undefined)).toEqual({ ok: true, photos: [] })
      expect(verifierPhotos('cmd-1', [bonne])).toEqual({ ok: true, photos: [{ url: bonne.secure_url, publicId: id('aaaaaaaa') }] })
      const refus = { ok: false, code: 'invalide' }
      expect(verifierPhotos('cmd-1', [{ ...bonne, signature: 'f'.repeat(40) }])).toEqual(refus)
      expect(verifierPhotos('cmd-2', [bonne])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa'), { format: 'pdf' })])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa'), { resource_type: 'video' })])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa'), { bytes: 5 * 1024 * 1024 + 1 })])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa'), { bytes: 5 * 1024 * 1024 })])).toMatchObject({ ok: true })
      expect(verifierPhotos('cmd-1', [{ ...bonne, secure_url: 'https://autre.exemple/x.jpg' }])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [bonne, bonne])).toEqual(refus)
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa')), reponsePhoto(id('bbbbbbbb')), reponsePhoto(id('cccccccc')), reponsePhoto(id('dddddddd'))])).toEqual({ ok: false, code: 'trop' })
      expect(verifierPhotos('cmd-1', 'pas une liste')).toEqual(refus)
      expect(verifierPhotos('cmd-1', [null])).toEqual(refus)
      // HEIC : Cloudinary convertit en JPEG à la livraison.
      expect(verifierPhotos('cmd-1', [reponsePhoto(id('aaaaaaaa'), { format: 'heic', secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1234567890/${id('aaaaaaaa')}.heic` })])).toMatchObject({ ok: true, photos: [{ url: expect.stringMatching(/\.jpg$/) }] })
    })
  })

  it('l’e-mail « Livraison » porte « Signaler un problème » vers la page de suivi, sans durée ni promesse', async () => {
    const { contenuCommandeLivree } = await import('@/lib/notifications/contenus')
    const avec = contenuCommandeLivree({ nom: 'Claire', numero: 'ERR-AAAA-BBBB', artiste: 'Artiste A', titres: ['Titre'], lienSuivi: 'https://www.errancy.art/suivi/abc' })
    expect(avec.texte).toContain(fr.courriels.commande.livraison.boutonSignaler)
    expect(avec.html).toContain('href="https://www.errancy.art/suivi/abc"')
    expect(avec.texte).not.toMatch(/rembours|gratuit|garanti|\d+ jours/i)
    const sans = contenuCommandeLivree({ nom: 'Claire', numero: 'ERR-AAAA-BBBB', artiste: null, titres: ['Titre'] })
    expect(sans.texte).not.toContain(fr.courriels.commande.livraison.boutonSignaler)
  })
})

describe('base : réclamation et retour', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const a = (adresse: string) => envoi.envoyes.filter((e) => e.a === adresse)

  async function oeuvre(slug: string, artiste: string, prix: number) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $4, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste, prix],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, 3, 5, 9, 'EUR', now())`,
      [slug],
    )
  }

  /** Vente assistée de o1 (A, 60 000 + 4 000 de livraison) et o2 (B), payée, prise en charge, expédiée et LIVRÉE (acheteur). */
  async function livree(): Promise<{ numero: string; commandeId: string; passageId: string; jeton: string }> {
    await oeuvre('o1', 'art-a', 60000)
    await oeuvre('o2', 'art-b', 50000)
    const { poserVenteAssistee, traiterPaiementConstate, prendreEnCharge, marquerExpediee, constaterLivraisonAcheteur } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { email: EMAIL_ACHETEUR, nom: NOM_ACHETEUR, pays: 'FR', oeuvres: ['o1', 'o2'] })
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    await db.query(`UPDATE "CoordonneesAcheteur" SET adresse = $2, telephone = $3 WHERE "passageId" = $1`, [r.passageId, ADRESSE, TELEPHONE])
    const total = Number((await db.query(`SELECT sum("totalCentimes") AS s FROM "LigneCommande" l JOIN "Commande" c ON c.id = l."commandeId" WHERE c."passageId" = $1`, [r.passageId])).rows[0].s)
    const c = await traiterPaiementConstate(ADMIN, { passageId: r.passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: total, constatePar: 'admin-1', constateLe: new Date() } as never)
    expect(c).toMatchObject({ ok: true, commandes: 2 })
    const ligne = (await db.query(`SELECT id, numero FROM "Commande" WHERE "artistId" = 'art-a'`)).rows[0]
    expect(await prendreEnCharge(ARTISTE_A, ligne.numero)).toMatchObject({ ok: true })
    expect(await marquerExpediee(ARTISTE_A, ligne.numero, { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE' })).toMatchObject({ ok: true })
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    const { jeton } = await prisma.$transaction((tx) => emettreJetonSuivi(tx, r.passageId))
    expect(await constaterLivraisonAcheteur(jeton, ligne.numero)).toMatchObject({ ok: true })
    envoi.envoyes.length = 0
    return { numero: ligne.numero as string, commandeId: ligne.id as string, passageId: r.passageId, jeton }
  }
  const ligneDe = async (numero: string) =>
    (await db.query(`SELECT etat::text AS etat, "retourAvant", "retourRecuLe", "retourRecuPar" FROM "Commande" WHERE numero = $1`, [numero])).rows[0]
  const reclamationDe = async (numero: string) =>
    (await db.query(`SELECT r.* FROM "Reclamation" r JOIN "Commande" c ON c.id = r."commandeId" WHERE c.numero = $1`, [numero])).rows[0]
  const SAISIE = { motif: 'abimee', description: DESCRIPTION }
  /** Allocation de la commande de l'artiste A : 60 000 + 4 000. */
  const ALLOCATION = 64000

  async function signaler(p: { numero: string; jeton: string }, saisie: Record<string, unknown> = SAISIE) {
    const { signalerProbleme } = await import('@/lib/commandes')
    return signalerProbleme(p.jeton, p.numero, saisie)
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
  })
  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', CLOUD)
    vi.stubEnv('CLOUDINARY_API_KEY', 'cle-de-test')
    vi.stubEnv('CLOUDINARY_API_SECRET', SECRET)
    acteur.courant = { type: 'visiteur' }
    cookie.suivi = undefined
    envoi.envoyes.length = 0
    for (const table of ['PhotoReclamation', 'Reclamation', 'Incident', 'RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist', 'User']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('user-a', 'artiste-a@exemple.test', 'artist', now()), ('user-b', 'artiste-b@exemple.test', 'artist', now())`)
    for (const [id, user] of [['art-a', 'user-a'], ['art-b', 'user-b']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "userId", "updatedAt")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), $3, now())`,
        [id, id === 'art-a' ? 'Artiste A' : 'Artiste B', user],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('signalement dans le délai avec deux photos : réclamation ouverte, photos enregistrées, un événement sans donnée, alerte équipe sans donnée personnelle', async () => {
    const p = await livree()
    const { CONTACT_EQUIPE } = await import('@/lib/reglages')
    const dossier = `errancy/reclamations/${p.commandeId}`
    const photos = [reponsePhoto(`${dossier}/photo-aaaaaaaa`), reponsePhoto(`${dossier}/photo-bbbbbbbb`)]
    expect(await signaler(p, { ...SAISIE, photos })).toEqual({ ok: true, dejaOuverte: false })
    const r = await reclamationDe(p.numero)
    expect(r).toMatchObject({ motif: 'abimee', description: DESCRIPTION, etat: 'ouverte', decidePar: null })
    expect(await compter('PhotoReclamation', `WHERE "reclamationId" = '${r.id}'`)).toBe(2)
    expect((await ligneDe(p.numero)).etat).toBe('livree')
    expect(await compter('Evenement', `WHERE nom = 'ReclamationOuverte'`)).toBe(1)
    const charge = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'ReclamationOuverte'`)).rows[0].charge
    expect(Object.keys(charge)).toEqual(['reclamationId'])
    expect(envoi.envoyes).toHaveLength(1)
    const alerte = envoi.envoyes[0]
    expect(alerte.a).toBe(CONTACT_EQUIPE)
    expect(alerte.texte).toContain(p.numero)
    expect(alerte.texte + alerte.html + alerte.sujet).not.toMatch(/Claire|Martin|exemple\.test|Lilas|fendu|photo-aaaaaaaa/)
  })

  it('une seule réclamation par commande : un rejeu ouvert est un succès sans effet ; après décision, `reclamation_deja_traitee`', async () => {
    const p = await livree()
    expect(await signaler(p)).toEqual({ ok: true, dejaOuverte: false })
    expect(await signaler(p, { motif: 'non_conforme', description: 'Autre texte' })).toEqual({ ok: true, dejaOuverte: true })
    expect(await compter('Reclamation')).toBe(1)
    expect((await reclamationDe(p.numero)).motif).toBe('abimee')
    expect(await compter('Evenement', `WHERE nom = 'ReclamationOuverte'`)).toBe(1)
    const { refuserReclamation } = await import('@/lib/commandes')
    await refuserReclamation(ADMIN, p.numero, 'La photo ne montre aucun dommage.')
    expect(await signaler(p)).toEqual({ ok: false, code: 'reclamation_deja_traitee' })
    expect(await compter('Reclamation')).toBe(1)
  })

  it('deux signalements simultanés : une seule réclamation, un seul événement, une seule alerte', async () => {
    const p = await livree()
    const [x, y] = await Promise.all([signaler(p), signaler(p)])
    expect([x, y].filter((r) => r.ok && !(r as { dejaOuverte: boolean }).dejaOuverte)).toHaveLength(1)
    expect(await compter('Reclamation')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'ReclamationOuverte'`)).toBe(1)
    expect(envoi.envoyes).toHaveLength(1)
  })

  it('photos invalides : `invalide` avec l’erreur du champ, rien enregistré', async () => {
    const p = await livree()
    const dossier = `errancy/reclamations/${p.commandeId}`
    const bonne = (n: string) => reponsePhoto(`${dossier}/photo-${n}`)
    for (const photos of [
      [bonne('aaaaaaaa'), bonne('bbbbbbbb'), bonne('cccccccc'), bonne('dddddddd')],
      [reponsePhoto(`${dossier}/photo-aaaaaaaa`, { bytes: 6 * 1024 * 1024 })],
      [reponsePhoto(`${dossier}/photo-aaaaaaaa`, { format: 'pdf' })],
      [{ ...bonne('aaaaaaaa'), signature: 'f'.repeat(40) }],
      [reponsePhoto('errancy/reclamations/autre-commande/photo-aaaaaaaa')],
      'pas une liste',
    ]) {
      const r = await signaler(p, { ...SAISIE, photos })
      expect(r.ok, JSON.stringify(photos).slice(0, 40)).toBe(false)
      expect(r).toMatchObject({ code: 'invalide', erreurs: { photos: expect.any(String) } })
    }
    expect(await compter('Reclamation')).toBe(0)
    expect(await compter('PhotoReclamation')).toBe(0)
    expect(await compter('Evenement', `WHERE nom = 'ReclamationOuverte'`)).toBe(0)
  })

  it('saisie invalide : motif inconnu, description vide ou trop longue : `invalide`, erreurs par champ, rien écrit', async () => {
    const p = await livree()
    expect(await signaler(p, { motif: 'autre', description: DESCRIPTION })).toEqual({ ok: false, code: 'invalide', erreurs: { motif: 'invalide' } })
    expect(await signaler(p, { motif: 'abimee', description: '  ' })).toEqual({ ok: false, code: 'invalide', erreurs: { description: 'requis' } })
    expect(await signaler(p, { motif: 'abimee', description: 'Abîmée' })).toEqual({ ok: false, code: 'invalide', erreurs: { description: 'trop_court' } })
    expect(await signaler(p, { motif: 'abimee', description: 'x'.repeat(1001) })).toEqual({ ok: false, code: 'invalide', erreurs: { description: 'trop_long' } })
    expect(await compter('Reclamation')).toBe(0)
  })

  it('délai échu : `delai_echu`, rien écrit, bouton absent, Conseil toujours là ; la photo n’est plus signée', async () => {
    const p = await livree()
    await db.query(`UPDATE "Commande" SET "retourAvant" = now() - interval '1 minute' WHERE numero = $1`, [p.numero])
    expect(await signaler(p)).toEqual({ ok: false, code: 'delai_echu' })
    const { preparerEnvoiPhotoReclamation, lireSuiviPassage } = await import('@/lib/commandes')
    expect(await preparerEnvoiPhotoReclamation(p.jeton, p.numero)).toEqual({ ok: false, code: 'delai_echu' })
    expect(await compter('Reclamation')).toBe(0)
    const vue = await lireSuiviPassage(p.jeton)
    expect(vue?.commandes.find((c) => c.numero === p.numero)).toMatchObject({ peutSignalerProbleme: false, reclamation: null })
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    const html = texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: 'CONSEIL-WHATSAPP' }))
    expect(html).not.toContain(fr.suivi.reclamation.bouton)
    expect(html).toContain(fr.suivi.reclamation.delaiEchu)
    expect(html).toContain('CONSEIL-WHATSAPP')
  })

  it('une réclamation ouverte dans le délai reste traitable après l’échéance', async () => {
    const p = await livree()
    await signaler(p)
    await db.query(`UPDATE "Commande" SET "retourAvant" = now() - interval '2 days' WHERE numero = $1`, [p.numero])
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    expect(await accepterReclamation(ADMIN, p.numero)).toEqual({ ok: true, dejaTraitee: false })
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: true, dejaRetournee: false })
  })

  it('mauvais état, autre passage, jeton invalide : `etat_invalide` / `introuvable`, rien écrit', async () => {
    const p = await livree()
    const { lireSuiviPassage } = await import('@/lib/commandes')
    // Autre commande du passage (artiste B) : expédiée n'est pas atteinte, elle est seulement confirmée.
    const autre = (await db.query(`SELECT numero FROM "Commande" WHERE "artistId" = 'art-b'`)).rows[0].numero as string
    expect(await signaler({ numero: autre, jeton: p.jeton })).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await signaler({ numero: p.numero, jeton: 'jeton-inconnu' })).toEqual({ ok: false, code: 'introuvable' })
    expect(await signaler({ numero: p.numero, jeton: undefined as never })).toEqual({ ok: false, code: 'introuvable' })
    expect(await signaler({ numero: 'ERR-0000-0000', jeton: p.jeton })).toEqual({ ok: false, code: 'introuvable' })
    expect(await signaler({ numero: '', jeton: p.jeton })).toEqual({ ok: false, code: 'introuvable' })
    // Un second passage : son jeton ne donne aucun accès à la commande du premier.
    await oeuvre('o3', 'art-a', 20000)
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r2 = await poserVenteAssistee(ADMIN, { email: 'autre@exemple.test', nom: 'Autre Acheteur', pays: 'FR', oeuvres: ['o3'] })
    if (!r2.ok) throw new Error('pose refusée')
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    const { jeton: jeton2 } = await prisma.$transaction((tx) => emettreJetonSuivi(tx, r2.passageId))
    expect(await signaler({ numero: p.numero, jeton: jeton2 })).toEqual({ ok: false, code: 'introuvable' })
    const { preparerEnvoiPhotoReclamation } = await import('@/lib/commandes')
    expect(await preparerEnvoiPhotoReclamation(jeton2, p.numero)).toEqual({ ok: false, code: 'introuvable' })
    expect(await preparerEnvoiPhotoReclamation(p.jeton, autre)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await compter('Reclamation')).toBe(0)
    expect(JSON.stringify(await lireSuiviPassage(p.jeton))).not.toContain('Autre Acheteur')
  })

  it('préparer une photo : signature pour la commande de l’acheteur ; plus rien une fois la réclamation déposée', async () => {
    const p = await livree()
    const { preparerEnvoiPhotoReclamation } = await import('@/lib/commandes')
    const r = await preparerEnvoiPhotoReclamation(p.jeton, p.numero)
    expect(r).toMatchObject({ ok: true })
    if (r.ok) expect(r.envoi.publicId).toContain(`errancy/reclamations/${p.commandeId}/photo-`)
    await signaler(p)
    expect(await preparerEnvoiPhotoReclamation(p.jeton, p.numero)).toEqual({ ok: false, code: 'reclamation_deja_traitee' })
    vi.stubEnv('CLOUDINARY_API_SECRET', '')
    // Sans configuration (et sans réclamation) : `envoi_indisponible`.
    await db.query(`DELETE FROM "Reclamation"`)
    expect(await preparerEnvoiPhotoReclamation(p.jeton, p.numero)).toEqual({ ok: false, code: 'envoi_indisponible' })
  })

  it('acceptation : admin seulement ; réclamation acceptée, e-mails à l’acheteur et à l’artiste sans promesse ni coordonnées, aucun remboursement', async () => {
    const p = await livree()
    await signaler(p)
    envoi.envoyes.length = 0
    const { accepterReclamation } = await import('@/lib/commandes')
    for (const qui of [ARTISTE_A, ARTISTE_B, { type: 'user', userId: 'u' }, { type: 'visiteur' }]) {
      expect(await accepterReclamation(qui as never, p.numero)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect((await reclamationDe(p.numero)).etat).toBe('ouverte')
    expect(await accepterReclamation(ADMIN, 'ERR-0000-0000')).toEqual({ ok: false, code: 'introuvable' })
    expect(await accepterReclamation(ADMIN, p.numero)).toEqual({ ok: true, dejaTraitee: false })
    const r = await reclamationDe(p.numero)
    expect(r).toMatchObject({ etat: 'acceptee', decidePar: 'admin-1', motifRefus: null })
    expect(r.decideLe).toBeInstanceOf(Date)
    expect(await compter('RemboursementCommande')).toBe(0)
    expect((await ligneDe(p.numero)).etat).toBe('livree')
    expect(await compter('Evenement', `WHERE nom = 'ReclamationTraitee'`)).toBe(1)
    const acheteur = a(EMAIL_ACHETEUR)
    expect(acheteur).toHaveLength(1)
    expect(acheteur[0].sujet).toBe(fr.courriels.commande.reclamationAcceptee.sujet(p.numero))
    expect(acheteur[0].texte).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/)
    expect(acheteur[0].texte).not.toMatch(/rembours|gratuit|garanti|\d+ jours/i)
    const artiste = a('artiste-a@exemple.test')
    expect(artiste).toHaveLength(1)
    expect(artiste[0].sujet).toBe(fr.courriels.commande.retourArtiste.sujet(p.numero))
    expect(artiste[0].texte).toContain('Titre o1')
    expect(artiste[0].texte + artiste[0].html).not.toMatch(/Claire|Martin|exemple\.test\b.*claire|Lilas|6 12 34|fendu|photo-/i)
    expect(artiste[0].texte).not.toContain(EMAIL_ACHETEUR)
    expect(envoi.envoyes).toHaveLength(2)
    // Rejeu : succès sans effet, aucun nouvel événement ni e-mail.
    expect(await accepterReclamation(ADMIN, p.numero)).toEqual({ ok: true, dejaTraitee: true })
    expect(await compter('Evenement', `WHERE nom = 'ReclamationTraitee'`)).toBe(1)
    expect(envoi.envoyes).toHaveLength(2)
  })

  it('acceptations simultanées : une seule décision, un seul événement, deux e-mails en tout', async () => {
    const p = await livree()
    await signaler(p)
    envoi.envoyes.length = 0
    const { accepterReclamation } = await import('@/lib/commandes')
    const resultats = await Promise.all([accepterReclamation(ADMIN, p.numero), accepterReclamation(ADMIN, p.numero)])
    expect(resultats.filter((r) => r.ok && !(r as { dejaTraitee: boolean }).dejaTraitee)).toHaveLength(1)
    expect(await compter('Evenement', `WHERE nom = 'ReclamationTraitee'`)).toBe(1)
    expect(envoi.envoyes).toHaveLength(2)
  })

  it('refus : motif de 10 à 500 caractères, lu par l’acheteur (page et e-mail), définitif ; aucun e-mail à l’artiste', async () => {
    const p = await livree()
    await signaler(p)
    envoi.envoyes.length = 0
    const { refuserReclamation, accepterReclamation, lireSuiviPassage } = await import('@/lib/commandes')
    const MOTIF = 'Les photos ne montrent aucun dommage sur l’œuvre.'
    expect(await refuserReclamation(ARTISTE_A, p.numero, MOTIF)).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await refuserReclamation(ADMIN, p.numero, '')).toEqual({ ok: false, code: 'motif_invalide', erreur: 'obligatoire' })
    expect(await refuserReclamation(ADMIN, p.numero, 'court')).toEqual({ ok: false, code: 'motif_invalide', erreur: 'trop_court' })
    expect(await refuserReclamation(ADMIN, p.numero, 'x'.repeat(501))).toEqual({ ok: false, code: 'motif_invalide', erreur: 'trop_long' })
    expect((await reclamationDe(p.numero)).etat).toBe('ouverte')
    expect(await refuserReclamation(ADMIN, p.numero, MOTIF)).toEqual({ ok: true, dejaTraitee: false })
    expect(await reclamationDe(p.numero)).toMatchObject({ etat: 'refusee', motifRefus: MOTIF, decidePar: 'admin-1' })
    expect(await refuserReclamation(ADMIN, p.numero, 'Un autre motif écrit après coup.')).toEqual({ ok: true, dejaTraitee: true })
    expect((await reclamationDe(p.numero)).motifRefus).toBe(MOTIF)
    expect(await accepterReclamation(ADMIN, p.numero)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await compter('Evenement', `WHERE nom = 'ReclamationTraitee'`)).toBe(1)
    const mails = a(EMAIL_ACHETEUR)
    expect(mails).toHaveLength(1)
    expect(mails[0].texte).toContain(MOTIF)
    expect(a('artiste-a@exemple.test')).toHaveLength(0)
    expect(envoi.envoyes).toHaveLength(1)
    // Page de suivi : état, motif, aucun nouveau signalement.
    const vue = await lireSuiviPassage(p.jeton)
    const c = vue?.commandes.find((x) => x.numero === p.numero)
    expect(c).toMatchObject({ peutSignalerProbleme: false, reclamation: { etat: 'refusee', motifRefus: MOTIF } })
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    const html = texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: 'CONSEIL-WHATSAPP' }))
    expect(html).toContain(fr.suivi.reclamation.etats.refusee)
    expect(html).toContain(MOTIF)
    expect(html).not.toContain(fr.suivi.reclamation.bouton)
    expect(html).not.toContain(fr.suivi.reclamation.delaiEchu)
    expect(html).toContain('CONSEIL-WHATSAPP')
  })

  it('retour reçu : `livree` → `retournee`, remboursement `demande` de l’allocation par défaut, un événement, rejeu sans effet', async () => {
    const p = await livree()
    await signaler(p)
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    // Avant l'acceptation : refusé.
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: false, code: 'etat_invalide' })
    await accepterReclamation(ADMIN, p.numero)
    for (const qui of [ARTISTE_A, { type: 'user', userId: 'u' }, { type: 'visiteur' }]) {
      expect(await enregistrerRetourRecu(qui as never, p.numero)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect(await enregistrerRetourRecu(ADMIN, 'ERR-0000-0000')).toEqual({ ok: false, code: 'introuvable' })
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: true, dejaRetournee: false })
    const l = await ligneDe(p.numero)
    expect(l).toMatchObject({ etat: 'retournee', retourRecuPar: 'admin-1' })
    expect(l.retourRecuLe).toBeInstanceOf(Date)
    const remb = (await db.query(`SELECT "montantCentimes", etat::text AS etat, devise, "paiementId" FROM "RemboursementCommande"`)).rows
    expect(remb).toEqual([{ montantCentimes: ALLOCATION, etat: 'demande', devise: 'EUR', paiementId: expect.any(String) }])
    expect(await compter('Evenement', `WHERE nom = 'CommandeRetournee'`)).toBe(1)
    expect(Object.keys((await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'CommandeRetournee'`)).rows[0].charge)).toEqual(['commandeId'])
    // Rejeu et appuis simultanés : un seul remboursement, un seul événement.
    expect(await enregistrerRetourRecu(ADMIN, p.numero, { montantCentimes: 100 })).toEqual({ ok: true, dejaRetournee: true })
    const [x, y] = await Promise.all([enregistrerRetourRecu(ADMIN, p.numero), enregistrerRetourRecu(ADMIN, p.numero)])
    expect([x, y]).toEqual([{ ok: true, dejaRetournee: true }, { ok: true, dejaRetournee: true }])
    expect(await compter('RemboursementCommande')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeRetournee'`)).toBe(1)
    // `retournee` reste une commande vivante pour la confirmation, l'ouverture du suivi et l'émission d'un lien.
    const { lireConfirmationPassage, ouvrirSuiviDuNavigateur, emettreLienSuiviDeCommande } = await import('@/lib/commandes')
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const { prisma } = await import('@/lib/prisma')
    const publique = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, p.passageId, new Date(Date.now() + 3_600_000)))
    expect((await lireConfirmationPassage(publique))?.commandes.find((c) => c.numero === p.numero)).toBeTruthy()
    expect(await ouvrirSuiviDuNavigateur(publique, undefined)).not.toBeNull()
    expect(await emettreLienSuiviDeCommande(p.commandeId, { exigerCommandeVivante: true })).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('retour reçu, deux appuis simultanés : un seul remboursement et un seul événement', async () => {
    const p = await livree()
    await signaler(p)
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    await accepterReclamation(ADMIN, p.numero)
    const resultats = await Promise.all([enregistrerRetourRecu(ADMIN, p.numero), enregistrerRetourRecu(ADMIN, p.numero)])
    expect(resultats.filter((r) => r.ok && !(r as { dejaRetournee: boolean }).dejaRetournee)).toHaveLength(1)
    expect(await compter('RemboursementCommande')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeRetournee'`)).toBe(1)
  })

  it('retour reçu avec un montant partiel : remboursé tel quel ; au-delà de l’allocation ou nul : `montant_depasse`, rien d’écrit, la commande reste livrée', async () => {
    const p = await livree()
    await signaler(p)
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    await accepterReclamation(ADMIN, p.numero)
    for (const montant of [ALLOCATION + 1, 0, -100, 100.5, Number.NaN]) {
      expect(await enregistrerRetourRecu(ADMIN, p.numero, { montantCentimes: montant }), String(montant)).toEqual({ ok: false, code: 'montant_depasse' })
    }
    expect((await ligneDe(p.numero)).etat).toBe('livree')
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Evenement', `WHERE nom = 'CommandeRetournee'`)).toBe(0)
    // Le total du passage (deux commandes) n'est pas l'allocation de CETTE commande.
    expect(await enregistrerRetourRecu(ADMIN, p.numero, { montantCentimes: 64000 + 54000 })).toEqual({ ok: false, code: 'montant_depasse' })
    expect(await enregistrerRetourRecu(ADMIN, p.numero, { montantCentimes: 12000 })).toEqual({ ok: true, dejaRetournee: false })
    expect((await db.query(`SELECT "montantCentimes" FROM "RemboursementCommande"`)).rows).toEqual([{ montantCentimes: 12000 }])
  })

  it('retour reçu au montant exact de l’allocation : accepté', async () => {
    const p = await livree()
    await signaler(p)
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    await accepterReclamation(ADMIN, p.numero)
    expect(await enregistrerRetourRecu(ADMIN, p.numero, { montantCentimes: ALLOCATION })).toEqual({ ok: true, dejaRetournee: false })
  })

  it('retour reçu sans réclamation acceptée (aucune, ouverte ou refusée) : `etat_invalide`', async () => {
    const p = await livree()
    const { enregistrerRetourRecu, refuserReclamation } = await import('@/lib/commandes')
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: false, code: 'etat_invalide' })
    await signaler(p)
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: false, code: 'etat_invalide' })
    await refuserReclamation(ADMIN, p.numero, 'Aucun dommage constaté sur les photos.')
    expect(await enregistrerRetourRecu(ADMIN, p.numero)).toEqual({ ok: false, code: 'etat_invalide' })
    expect((await ligneDe(p.numero)).etat).toBe('livree')
  })

  it('/suivi : étape « Retournée » datée et état du remboursement, sans montant ni délai ; plus de signalement', async () => {
    const p = await livree()
    await signaler(p)
    const { accepterReclamation, enregistrerRetourRecu, lireSuiviPassage, marquerRemboursementEffectue } = await import('@/lib/commandes')
    await accepterReclamation(ADMIN, p.numero)
    await enregistrerRetourRecu(ADMIN, p.numero)
    const vue = await lireSuiviPassage(p.jeton)
    const c = vue?.commandes.find((x) => x.numero === p.numero)
    expect(c).toMatchObject({ etat: 'retournee', peutSignalerProbleme: false, peutConfirmerReception: false, remboursement: 'demande', reclamation: { etat: 'acceptee', motifRefus: null } })
    expect(c?.etapes.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'expediee', 'livree', 'retournee'])
    expect(JSON.stringify(vue)).not.toMatch(/montantCentimes|fendu|photo-|Lilas|exemple\.test/)
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    let html = texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: null }))
    expect(html).toContain(fr.suivi.etats.retournee)
    expect(html).toContain(fr.suivi.reclamation.remboursement.demande)
    expect(html).not.toContain(fr.suivi.reclamation.bouton)
    expect(html).not.toMatch(/gratuit|garanti/i)
    const id = (await db.query(`SELECT id FROM "RemboursementCommande"`)).rows[0].id as string
    await marquerRemboursementEffectue(ADMIN, id)
    html = texteDe(ListeSuivi({ commandes: (await lireSuiviPassage(p.jeton))?.commandes ?? [], conseil: null }))
    expect(html).toContain(fr.suivi.reclamation.remboursement.effectue)
  })

  it('/suivi : le bouton « Signaler un problème » est proposé dans le délai, puis l’état de la réclamation ouverte', async () => {
    const p = await livree()
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    let vue = await lireSuiviPassage(p.jeton)
    expect(vue?.commandes.find((c) => c.numero === p.numero)).toMatchObject({ peutSignalerProbleme: true, reclamation: null })
    expect(vue?.commandes.filter((c) => c.peutSignalerProbleme)).toHaveLength(1)
    expect(texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: null }))).toContain(fr.suivi.reclamation.bouton)
    await signaler(p)
    vue = await lireSuiviPassage(p.jeton)
    expect(vue?.commandes.find((c) => c.numero === p.numero)).toMatchObject({ peutSignalerProbleme: false, reclamation: { etat: 'ouverte' } })
    const html = texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: null }))
    expect(html).toContain(fr.suivi.reclamation.etats.ouverte)
    expect(html).not.toContain(fr.suivi.reclamation.bouton)
    expect(JSON.stringify(vue)).not.toMatch(/fendu|description/)
  })

  it('AD-16 : l’artiste ne lit jamais la réclamation ; une commande retournée disparaît de son espace', async () => {
    const p = await livree()
    const dossier = `errancy/reclamations/${p.commandeId}`
    await signaler(p, { ...SAISIE, photos: [reponsePhoto(`${dossier}/photo-aaaaaaaa`)] })
    const { commandeDeLArtiste, commandesDeLArtiste, accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    const detail = await commandeDeLArtiste(ARTISTE_A, p.numero)
    const liste = await commandesDeLArtiste(ARTISTE_A)
    expect(JSON.stringify([detail, liste])).not.toMatch(/fendu|photo-aaaaaaaa|reclamation|Lilas|6 12 34|exemple\.test/i)
    await accepterReclamation(ADMIN, p.numero)
    await enregistrerRetourRecu(ADMIN, p.numero)
    expect(await commandeDeLArtiste(ARTISTE_A, p.numero)).toEqual({ ok: false, code: 'introuvable' })
    const apres = await commandesDeLArtiste(ARTISTE_A)
    expect(apres.ok && apres.commandes.some((c) => c.numero === p.numero)).toBe(false)
    expect(await commandeDeLArtiste(ARTISTE_B, p.numero)).toEqual({ ok: false, code: 'introuvable' })
  })

  it('équipe : la réclamation (motif, description, photos) est lue de l’admin seulement ; les ouvertes ne sont jamais évincées', async () => {
    const p = await livree()
    const dossier = `errancy/reclamations/${p.commandeId}`
    await signaler(p, { ...SAISIE, photos: [reponsePhoto(`${dossier}/photo-aaaaaaaa`)] })
    const { commandesDeLEquipe, accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    expect(await commandesDeLEquipe(ARTISTE_A)).toBeNull()
    const vue = await commandesDeLEquipe(ADMIN)
    const c = vue?.commandes.find((x) => x.numero === p.numero)
    expect(c).toMatchObject({ etat: 'livree', retournable: false, allocationCentimes: null, reclamation: { motif: 'abimee', description: DESCRIPTION, etat: 'ouverte', photos: [expect.stringContaining('photo-aaaaaaaa')] } })
    await accepterReclamation(ADMIN, p.numero)
    const acceptee = (await commandesDeLEquipe(ADMIN))?.commandes.find((x) => x.numero === p.numero)
    expect(acceptee).toMatchObject({ retournable: true, allocationCentimes: ALLOCATION, devise: 'EUR' })
    await enregistrerRetourRecu(ADMIN, p.numero)
    const retournee = (await commandesDeLEquipe(ADMIN))?.commandes.find((x) => x.numero === p.numero)
    expect(retournee).toMatchObject({ etat: 'retournee', retournable: false, remboursement: { etat: 'demande', montantCentimes: ALLOCATION } })
    expect(retournee?.retourRecuLe).toBeInstanceOf(Date)
    expect(JSON.stringify(vue)).not.toMatch(/Lilas|6 12 34|exemple\.test|Claire/)
  })

  it('actions de l’acheteur : cookie `suivi`, photo signée, signalement, messages sans détail technique', async () => {
    const { preparerPhotoReclamation, signalerUnProbleme } = await import('@/app/suivi/actions')
    const t = fr.suivi.reclamation.erreurs
    const p = await livree()
    expect(await preparerPhotoReclamation(p.numero)).toEqual({ ok: false, message: t.introuvable })
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: DESCRIPTION, photos: [] })).toEqual({ ok: false, message: t.introuvable })
    cookie.suivi = p.jeton
    const signee = await preparerPhotoReclamation(p.numero)
    expect(signee).toMatchObject({ ok: true })
    expect(await signalerUnProbleme(p.numero, { motif: 'inconnu', description: DESCRIPTION, photos: [] })).toEqual({ ok: false, message: t.motif, champ: 'motif' })
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: '', photos: [] })).toEqual({ ok: false, message: t.descriptionRequise, champ: 'description' })
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: DESCRIPTION, photos: [{}] })).toEqual({ ok: false, message: t.photosInvalides, champ: 'photos' })
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: DESCRIPTION, photos: [] })).toEqual({ ok: true, message: fr.suivi.reclamation.reussi })
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: DESCRIPTION, photos: [] })).toEqual({ ok: true, message: fr.suivi.reclamation.deja })
    const { refuserReclamation } = await import('@/lib/commandes')
    await refuserReclamation(ADMIN, p.numero, 'Aucun dommage constaté sur les photos.')
    expect(await signalerUnProbleme(p.numero, { motif: 'abimee', description: DESCRIPTION, photos: [] })).toEqual({ ok: false, message: t.dejaTraitee })
    expect(await preparerPhotoReclamation(p.numero)).toEqual({ ok: false, message: t.dejaTraitee })
  })

  it('actions de l’équipe : accepter, refuser, retour reçu (montant en euros) ; non admin refusé', async () => {
    const { actionAccepterReclamation, actionRefuserReclamation, actionRetourRecu } = await import('@/app/dashboard/admin/commandes/actions')
    const t = fr.commandesEquipe.reclamation
    const p = await livree()
    await signaler(p)
    acteur.courant = ARTISTE_A as never
    expect(await actionAccepterReclamation(p.numero)).toEqual({ ok: false, message: t.refus.acces_refuse })
    expect(await actionRetourRecu(p.numero, '')).toEqual({ ok: false, message: t.refus.acces_refuse })
    acteur.courant = ADMIN as never
    expect(await actionRefuserReclamation(p.numero, 'court')).toEqual({ ok: false, message: t.erreurs.trop_court, champ: 'motif' })
    expect(await actionAccepterReclamation(p.numero)).toEqual({ ok: true, message: t.succes.acceptee })
    expect(await actionAccepterReclamation(p.numero)).toEqual({ ok: true, message: t.deja })
    expect(await actionRetourRecu(p.numero, 'abc')).toEqual({ ok: false, message: t.erreurs.montant, champ: 'montant' })
    expect(await actionRetourRecu(p.numero, '641')).toEqual({ ok: false, message: t.erreurs.montant_depasse, champ: 'montant' })
    expect(await actionRetourRecu(p.numero, '120,50')).toEqual({ ok: true, message: t.succes.retour })
    expect((await db.query(`SELECT "montantCentimes" FROM "RemboursementCommande"`)).rows).toEqual([{ montantCentimes: 12050 }])
    expect(await actionRetourRecu(p.numero, '')).toEqual({ ok: true, message: t.deja })
  })

  it('le signalement sur une commande déjà retournée ou annulée est refusé ; une commande annulée n’a pas de bouton', async () => {
    const p = await livree()
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    await signaler(p)
    await accepterReclamation(ADMIN, p.numero)
    await enregistrerRetourRecu(ADMIN, p.numero)
    expect(await signaler(p)).toEqual({ ok: false, code: 'reclamation_deja_traitee' })
    // Sans réclamation : `retournee` n'existe pas, mais l'état refuserait tout de même.
    await db.query(`DELETE FROM "PhotoReclamation"; DELETE FROM "Reclamation"`)
    expect(await signaler(p)).toEqual({ ok: false, code: 'etat_invalide' })
  })

  it('un événement de décision rejoué après le retour reçu envoie encore ; une réclamation encore ouverte n’envoie rien', async () => {
    const p = await livree()
    await signaler(p)
    const rec = (await reclamationDe(p.numero)).id as string
    const { envoyerDecisionReclamation, envoyerRetourAccepteArtiste } = await import('@/lib/notifications')
    envoi.envoyes.length = 0
    await envoyerDecisionReclamation({ id: 'evt-1', nom: 'ReclamationTraitee', version: 1, charge: { reclamationId: rec } } as never)
    await envoyerRetourAccepteArtiste({ id: 'evt-1', nom: 'ReclamationTraitee', version: 1, charge: { reclamationId: rec } } as never)
    expect(envoi.envoyes).toHaveLength(0)
    const { accepterReclamation, enregistrerRetourRecu } = await import('@/lib/commandes')
    await accepterReclamation(ADMIN, p.numero)
    await enregistrerRetourRecu(ADMIN, p.numero)
    envoi.envoyes.length = 0
    await envoyerDecisionReclamation({ id: 'evt-2', nom: 'ReclamationTraitee', version: 1, charge: { reclamationId: rec } } as never)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })
})
