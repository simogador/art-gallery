import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 8.1 (FR-22, AD-9, AD-10, AD-15, AD-16) : l'artiste prend en charge ses commandes. Base réelle ; envoi
// simulé (aucun vrai e-mail). Preuves sur la VALEUR rendue par le module (et la page) : adresse et téléphone
// seulement après la prise en charge, e-mail de l'acheteur jamais ; autre artiste et mauvais état sans fuite ;
// rejeu et appuis simultanés : un seul événement, un seul e-mail.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[] }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => ({ get: () => null }) }))
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
const ADRESSE = '12 rue des Lilas\n75011 Paris'
const TELEPHONE = '+33 6 12 34 56 78'
const TOTAL = 208000
const HEURE = 3_600_000

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

describe('sans base : règles et table de transitions', () => {
  it('prénom = premier mot du nom saisi (décision 1A) ; nom vide : « — »', async () => {
    const { prenom } = await import('@/lib/commandes/prise-en-charge-regles')
    expect(prenom('Claire Martin-Dupont')).toBe('Claire')
    expect(prenom('  Jean   Paul ')).toBe('Jean')
    expect(prenom('Zoé')).toBe('Zoé')
    for (const vide of ['', '   ', null, undefined]) expect(prenom(vide)).toBe('—')
  })

  it('échéance dépassée calculée à la lecture, bornes incluses ; sans échéance : jamais', async () => {
    const { echeanceDepassee } = await import('@/lib/commandes/prise-en-charge-regles')
    const t = new Date('2026-11-20T10:00:00Z')
    expect(echeanceDepassee(new Date('2026-11-20T09:59:59Z'), t)).toBe(true)
    expect(echeanceDepassee(t, t)).toBe(true)
    expect(echeanceDepassee(new Date('2026-11-20T10:00:01Z'), t)).toBe(false)
    expect(echeanceDepassee(null, t)).toBe(false)
    expect(echeanceDepassee(new Date('x'), t)).toBe(false)
  })

  it('transitions : confirmee → prise_en_charge seulement ; une prise en charge ne revient pas en arrière', async () => {
    const { transitionPermise, ETATS_COMMANDE } = await import('@/lib/commandes/etats')
    expect(ETATS_COMMANDE).toContain('prise_en_charge')
    expect(transitionPermise('confirmee', 'prise_en_charge')).toBe(true)
    for (const de of ['en_attente_paiement', 'annulee', 'historique', 'prise_en_charge'] as const) {
      expect(transitionPermise(de, 'prise_en_charge'), de).toBe(false)
    }
    expect(transitionPermise('prise_en_charge', 'confirmee')).toBe(false)
    expect(transitionPermise('prise_en_charge', 'annulee')).toBe(false)
  })

  it('événement CommandePriseEnCharge : charge = commandeId seulement ; relié à l’e-mail de l’acheteur', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(evenementValide({ nom: 'CommandePriseEnCharge', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandePriseEnCharge', charge: { commandeId: 'x', email: 'a@b.c' } })).toBe(false)
    expect(ABONNEMENTS.CommandePriseEnCharge.map((a) => a.nom)).toEqual(['envoyerPriseEnChargeCommande'])
  })

  it('dictionnaire : ni promesse d’assurance, de casse ou de garantie, ni compte à rebours, ni montant', () => {
    const json = JSON.stringify([fr.commandesArtiste, fr.courriels.commande.priseEnCharge, fr.courriels.commande.artiste])
    expect(json).not.toMatch(/garanti|assur|cass|compte à rebours|rembours|€|devise|r[ée]servation|disponibilit/i)
  })

  it('la migration ajoute la valeur avant `annulee`, trois colonnes et rattrape l’échéance des confirmées', () => {
    const sql = readFileSync('prisma/migrations/20261123090000_prise_en_charge/migration.sql', 'utf8')
    expect(sql).toContain(`ADD VALUE 'prise_en_charge' BEFORE 'annulee'`)
    for (const col of ['priseEnChargeAvant', 'priseEnChargeLe', 'priseEnChargePar']) expect(sql).toContain(`"${col}"`)
    expect(sql).toMatch(/UPDATE "Commande"[\s\S]*INTERVAL '48 hours'[\s\S]*"etat" = 'confirmee'/)
  })
})

describe('base : prise en charge par l’artiste', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const a = (adresse: string) => envoi.envoyes.filter((e) => e.a === adresse)

  async function oeuvre(slug: string, artiste: string) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 100000, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, 3, 5, 9, 'EUR', now())`,
      [slug],
    )
  }

  /** Vente assistée (indépendante du Lot 2) de o1 (artiste A) et o2 (artiste B), adresse complétée par l'acheteur. */
  async function poser(): Promise<string> {
    await oeuvre('o1', 'art-a')
    await oeuvre('o2', 'art-b')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { email: EMAIL_ACHETEUR, nom: 'Claire Martin-Dupont', pays: 'FR', oeuvres: ['o1', 'o2'] })
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    await db.query(`UPDATE "CoordonneesAcheteur" SET adresse = $2, telephone = $3 WHERE "passageId" = $1`, [r.passageId, ADRESSE, TELEPHONE])
    envoi.envoyes.length = 0
    return r.passageId
  }
  async function constater(passageId: string, constateLe = new Date()) {
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, { passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: TOTAL, constatePar: 'admin-1', constateLe } as never)
    expect(r).toMatchObject({ ok: true, commandes: 2 })
    envoi.envoyes.length = 0
    return constateLe
  }
  const numeroDe = async (artiste: string) =>
    (await db.query(`SELECT numero FROM "Commande" WHERE "artistId" = $1`, [artiste])).rows[0].numero as string
  const ligneDe = async (numero: string) =>
    (await db.query(`SELECT etat::text AS etat, "priseEnChargeAvant", "priseEnChargeLe", "priseEnChargePar" FROM "Commande" WHERE numero = $1`, [numero])).rows[0]

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
    acteur.courant = { type: 'visiteur' }
    envoi.envoyes.length = 0
    for (const table of ['Incident', 'RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist', 'User']) {
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

  it('avant la prise en charge : œuvres, prénom, pays, échéance (constat + 48 h) ; ni adresse, ni téléphone, ni e-mail', async () => {
    const passage = await poser()
    const constate = await constater(passage)
    const numero = await numeroDe('art-a')
    expect(new Date((await ligneDe(numero)).priseEnChargeAvant).getTime()).toBe(constate.getTime() + 48 * HEURE)

    const { commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.commande).toMatchObject({ numero, etat: 'confirmee', oeuvres: ['Titre o1'], prenom: 'Claire', pays: { code: 'FR', nom: 'France' }, echeanceDepassee: false })
    expect(lu.commande.priseEnChargeAvant?.getTime()).toBe(constate.getTime() + 48 * HEURE)
    expect('adresse' in lu.commande).toBe(false)
    expect('telephone' in lu.commande).toBe(false)
    const json = JSON.stringify(lu)
    for (const secret of ['Lilas', '75011', '6 12 34', EMAIL_ACHETEUR, 'exemple.test', 'Martin', 'Dupont', 'Titre o2']) expect(json).not.toContain(secret)

    const liste = await commandesDeLArtiste(ARTISTE_A)
    expect(liste.ok && liste.commandes.map((c) => c.numero)).toEqual([numero])
    expect(JSON.stringify(liste)).not.toMatch(/Lilas|6 12 34|exemple\.test|Martin/)
    expect(await nombreAPrendreEnCharge(ARTISTE_A)).toEqual({ ok: true, nombre: 1 })
  })

  it('prise en charge : état, date et auteur, un événement, e-mail à l’acheteur avec lien de suivi ; adresse et téléphone ensuite', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    const avant = Date.now()
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: true, dejaPriseEnCharge: false })
    const ligne = await ligneDe(numero)
    expect(ligne.etat).toBe('prise_en_charge')
    expect(ligne.priseEnChargePar).toBe('user-a')
    expect(new Date(ligne.priseEnChargeLe).getTime()).toBeGreaterThanOrEqual(avant - 1000)
    expect(await compter('Evenement', `WHERE nom = 'CommandePriseEnCharge'`)).toBe(1)
    const charge = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'CommandePriseEnCharge'`)).rows[0].charge
    expect(Object.keys(charge)).toEqual(['commandeId'])

    const mails = a(EMAIL_ACHETEUR)
    expect(mails).toHaveLength(1)
    expect(mails[0].sujet).toBe(fr.courriels.commande.priseEnCharge.sujet(numero))
    expect(mails[0].texte).toContain(fr.courriels.commande.priseEnCharge.intro(numero, 'Artiste A'))
    expect(mails[0].texte).toContain('Délai de livraison estimé : 8 à 12 jours.')
    expect(mails[0].texte).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/)
    expect(envoi.envoyes).toHaveLength(1)

    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande).toMatchObject({ etat: 'prise_en_charge', adresse: ADRESSE, telephone: TELEPHONE, prenom: 'Claire', echeanceDepassee: false })
    expect(JSON.stringify(lu)).not.toContain(EMAIL_ACHETEUR)
    expect(await nombreAPrendreEnCharge(ARTISTE_A)).toEqual({ ok: true, nombre: 0 })
  })

  it('rejeu : succès sans effet, aucun second événement ni e-mail', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, numero)
    const date = (await ligneDe(numero)).priseEnChargeLe
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: true, dejaPriseEnCharge: true })
    expect((await ligneDe(numero)).priseEnChargeLe).toEqual(date)
    expect(await compter('Evenement', `WHERE nom = 'CommandePriseEnCharge'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('deux appuis simultanés : une seule prise en charge, un seul événement, un seul e-mail', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge } = await import('@/lib/commandes')
    const resultats = await Promise.all([prendreEnCharge(ARTISTE_A, numero), prendreEnCharge(ARTISTE_A, numero)])
    expect(resultats.map((r) => r.ok && r.dejaPriseEnCharge).sort()).toEqual([false, true])
    expect(await compter('Evenement', `WHERE nom = 'CommandePriseEnCharge'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('autre artiste : introuvable en lecture comme en action, rien n’est écrit ni montré', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste, commandesDeLArtiste } = await import('@/lib/commandes')
    expect(await commandeDeLArtiste(ARTISTE_B, numero)).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(ARTISTE_B, numero)).toEqual({ ok: false, code: 'introuvable' })
    // Numéro inconnu : même réponse.
    expect(await commandeDeLArtiste(ARTISTE_B, 'ERR-AAAA-AAAA')).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(ARTISTE_B, 'ERR-AAAA-AAAA')).toEqual({ ok: false, code: 'introuvable' })
    expect((await ligneDe(numero)).etat).toBe('confirmee')
    const listeB = await commandesDeLArtiste(ARTISTE_B)
    expect(listeB.ok && listeB.commandes.map((c) => c.numero)).toEqual([await numeroDe('art-b')])
    // B prend en charge sa propre commande : celle de A ne bouge pas.
    await prendreEnCharge(ARTISTE_B, await numeroDe('art-b'))
    expect((await ligneDe(numero)).etat).toBe('confirmee')
    expect(await compter('Evenement', `WHERE nom = 'CommandePriseEnCharge'`)).toBe(1)
  })

  it('artiste sans profil lié : rien à lire, action introuvable', async () => {
    const passage = await poser()
    await constater(passage)
    const sansProfil = { type: 'artist', userId: 'user-z', artiste: null } as never
    const { prendreEnCharge, commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    expect(await commandesDeLArtiste(sansProfil)).toEqual({ ok: true, commandes: [] })
    expect(await nombreAPrendreEnCharge(sansProfil)).toEqual({ ok: true, nombre: 0 })
    expect(await commandeDeLArtiste(sansProfil, await numeroDe('art-a'))).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(sansProfil, await numeroDe('art-a'))).toEqual({ ok: false, code: 'introuvable' })
  })

  it('mauvais état (en attente, annulée) : invisible pour l’artiste, action `etat_invalide` ; historique : introuvable', async () => {
    await poser()
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge, annulerCommande } = await import('@/lib/commandes')
    // En attente de paiement.
    expect(await commandesDeLArtiste(ARTISTE_A)).toEqual({ ok: true, commandes: [] })
    expect(await nombreAPrendreEnCharge(ARTISTE_A)).toEqual({ ok: true, nombre: 0 })
    expect(await commandeDeLArtiste(ARTISTE_A, numero)).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: false, code: 'etat_invalide' })
    // Annulée.
    const id = (await db.query(`SELECT id FROM "Commande" WHERE numero = $1`, [numero])).rows[0].id as string
    expect(await annulerCommande(ADMIN, id)).toMatchObject({ ok: true })
    expect(await commandeDeLArtiste(ARTISTE_A, numero)).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: false, code: 'etat_invalide' })
    // Historique : sans passage ni artiste (contrainte `Commande_forme_check`), elle n'est la commande d'aucun
    // artiste : introuvable, en lecture comme en action.
    await db.query(
      `INSERT INTO "Commande" (id, numero, etat, devise, "ordreHistoriqueId", "montantHistoriqueCentimes", "updatedAt")
       VALUES ('hist', 'ERR-HIST-0001', 'historique', 'EUR', 'ordre-1', 1000, now())`,
    )
    expect(await commandeDeLArtiste(ARTISTE_A, 'ERR-HIST-0001')).toEqual({ ok: false, code: 'introuvable' })
    expect(await prendreEnCharge(ARTISTE_A, 'ERR-HIST-0001')).toEqual({ ok: false, code: 'introuvable' })
    expect(await compter('Evenement', `WHERE nom = 'CommandePriseEnCharge'`)).toBe(0)
    expect((await db.query(`SELECT count(*) FROM "Commande" WHERE etat = 'prise_en_charge'`)).rows[0].count).toBe('0')
  })

  it('non artiste (visiteur, user, admin) : `acces_refuse` partout', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    for (const qui of [{ type: 'visiteur' }, { type: 'user', userId: 'user-a' }, ADMIN] as never[]) {
      expect(await commandesDeLArtiste(qui)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await nombreAPrendreEnCharge(qui)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await commandeDeLArtiste(qui, numero)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await prendreEnCharge(qui, numero)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect((await ligneDe(numero)).etat).toBe('confirmee')
  })

  it('échéance dépassée : dite à la lecture, prise en charge toujours permise', async () => {
    const passage = await poser()
    await constater(passage, new Date(Date.now() - 72 * HEURE))
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste } = await import('@/lib/commandes')
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande.echeanceDepassee).toBe(true)
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: true, dejaPriseEnCharge: false })
    const apres = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(apres.ok && apres.commande.echeanceDepassee).toBe(false)
  })

  it('après la prise en charge : /suivi montre l’étape datée, /confirmation la garde « Confirmée », « Modifier ma commande » refusé', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, lireSuiviPassage, lireConfirmationPassage } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, numero)
    const { prisma } = await import('@/lib/prisma')
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const suiviJeton = (await prisma.$transaction((tx) => emettreJetonSuivi(tx, passage))).jeton
    const suivi = await lireSuiviPassage(suiviJeton)
    const commande = suivi?.commandes.find((c) => c.numero === numero)
    expect(commande?.etat).toBe('prise_en_charge')
    expect(commande?.etapes.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'livraison'])
    const date = new Date((await ligneDe(numero)).priseEnChargeLe)
    expect(commande?.etapes[2]).toMatchObject({ faite: true })
    expect(commande?.etapes[2].date?.getTime()).toBe(date.getTime())
    expect(suivi?.commandes.find((c) => c.numero !== numero)?.etapes.map((e) => e.cle)).toEqual(['recue', 'paiement', 'livraison'])

    const jetonPassage = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, passage, new Date(Date.now() + HEURE)))
    const confirmation = await lireConfirmationPassage(jetonPassage)
    expect(confirmation?.etat).toBe('confirmee')
    expect(confirmation?.commandes.map((c) => c.etat)).toEqual(['confirmee', 'confirmee'])
    const { annulerPassagePublic } = await import('@/lib/commandes')
    expect(await annulerPassagePublic(jetonPassage)).toEqual({ ok: false, code: 'etat_invalide' })
  })

  it('pages : accueil (« À expédier » en premier, compteur masqué à zéro), commande avant et après, autre artiste en 404', async () => {
    const passage = await poser()
    acteur.courant = ARTISTE_A as never
    const { default: Accueil } = await import('@/app/dashboard/artiste/page')
    // Aucune commande confirmée ni prise en charge : bloc absent.
    expect(texteDe(await Accueil())).not.toContain(fr.commandesArtiste.bloc.titre)

    await constater(passage)
    const numero = await numeroDe('art-a')
    const html = renderToStaticMarkup((await Accueil()) as never)
    expect(html.indexOf(fr.commandesArtiste.bloc.titre)).toBeGreaterThan(-1)
    expect(html.indexOf(fr.commandesArtiste.bloc.titre)).toBeLessThan(html.indexOf('Mes œuvres'))
    expect(html).toContain('data-compteur')
    expect(texteDe(await Accueil())).toContain(fr.commandesArtiste.bloc.badge(1))

    const { default: PageCommande } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    const avant = texteDe(await PageCommande({ params: { numero } }))
    expect(avant).toContain(fr.commandesArtiste.zoneNeutre.etiquette)
    expect(avant).toContain(fr.commandesArtiste.action.prendre)
    expect(avant).toContain('Claire')
    for (const secret of ['Lilas', '6 12 34', EMAIL_ACHETEUR, 'Martin']) expect(avant).not.toContain(secret)

    const { prendreEnCharge } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, numero)
    const apres = texteDe(await PageCommande({ params: { numero } }))
    expect(apres).toContain('12 rue des Lilas')
    expect(apres).toContain(TELEPHONE)
    expect(apres).toContain(fr.commandesArtiste.guide.titre)
    expect(apres).not.toContain(fr.commandesArtiste.action.prendre)
    expect(apres).not.toContain(EMAIL_ACHETEUR)
    // Toutes prises en charge : compteur masqué, bloc présent.
    const accueilApres = renderToStaticMarkup((await Accueil()) as never)
    expect(accueilApres).toContain(fr.commandesArtiste.bloc.titre)
    expect(accueilApres).not.toContain('data-compteur')

    acteur.courant = ARTISTE_B as never
    await expect(PageCommande({ params: { numero } })).rejects.toThrow('NEXT_NOT_FOUND')
    acteur.courant = { type: 'user', userId: 'user-a' }
    await expect(PageCommande({ params: { numero } })).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    acteur.courant = { type: 'visiteur' }
    await expect(PageCommande({ params: { numero } })).rejects.toThrow('NEXT_REDIRECT:/auth/connexion')
  })

  it('adresse ou téléphone vides (vente assistée) : null, « Non renseigné » sur la page', async () => {
    const passage = await poser()
    await db.query(`UPDATE "CoordonneesAcheteur" SET adresse = '', telephone = '   ' WHERE "passageId" = $1`, [passage])
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { prendreEnCharge, commandeDeLArtiste } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, numero)
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande).toMatchObject({ adresse: null, telephone: null })
    acteur.courant = ARTISTE_A as never
    const { default: PageCommande } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    const texte = texteDe(await PageCommande({ params: { numero } }))
    // Décision 6A : adresse absente = l'équipe la communique ; téléphone absent = « Non renseigné ».
    expect(texte).toContain(fr.commandesArtiste.livraison.adresseAttendue)
    expect(texte.match(new RegExp(fr.commandesArtiste.livraison.nonRenseigne, 'g'))).toHaveLength(1)
  })

  it('numéro mal encodé dans l’adresse : 404, jamais d’exception', async () => {
    acteur.courant = ARTISTE_A as never
    const { default: PageCommande, generateMetadata } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    await expect(PageCommande({ params: { numero: '%E0%A4%A' } })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(generateMetadata({ params: { numero: '%E0%A4%A' } }).title).toBe(fr.commandesArtiste.titreDocument)
  })

  it('« Modifier ma commande » sur un passage tout pris en charge : `etat_invalide`, jeton du navigateur non révoqué', async () => {
    const passage = await poser()
    await constater(passage)
    const { prendreEnCharge, annulerPassagePublic } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, await numeroDe('art-a'))
    await prendreEnCharge(ARTISTE_B, await numeroDe('art-b'))
    const { prisma } = await import('@/lib/prisma')
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const jeton = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, passage, new Date(Date.now() + HEURE)))
    expect(await annulerPassagePublic(jeton)).toEqual({ ok: false, code: 'etat_invalide' })
    expect((await db.query(`SELECT "revoqueLe" FROM "Jeton" WHERE usage = 'commande_publique'`)).rows).toEqual([{ revoqueLe: null }])
    expect(await compter('Commande', `WHERE etat = 'prise_en_charge'`)).toBe(2)
  })

  it('ordre de la liste : à prendre en charge par échéance croissante, puis les prises en charge', async () => {
    const { poserVenteAssistee, traiterPaiementConstate, prendreEnCharge, commandesDeLArtiste } = await import('@/lib/commandes')
    const numeros: string[] = []
    for (const slug of ['p1', 'p2', 'p3']) {
      await oeuvre(slug, 'art-a')
      const r = await poserVenteAssistee(ADMIN, { email: `${slug}@exemple.test`, nom: 'Acheteur', pays: 'FR', oeuvres: [slug] })
      if (!r.ok) throw new Error(r.code)
      expect(await traiterPaiementConstate(ADMIN, { passageId: r.passageId, source: 'constat_manuel', referenceExterne: `VIR-${slug}`, montantCentimes: 104000 } as never)).toMatchObject({ ok: true, commandes: 1 })
      numeros.push((await db.query(`SELECT c.numero FROM "Commande" c WHERE c."passageId" = $1`, [r.passageId])).rows[0].numero)
    }
    // p1 : échéance la plus lointaine ; p2 : la plus proche ; p3 : prise en charge.
    await db.query(`UPDATE "Commande" SET "priseEnChargeAvant" = now() + INTERVAL '40 hours' WHERE numero = $1`, [numeros[0]])
    await db.query(`UPDATE "Commande" SET "priseEnChargeAvant" = now() + INTERVAL '2 hours' WHERE numero = $1`, [numeros[1]])
    await prendreEnCharge(ARTISTE_A, numeros[2])
    const liste = await commandesDeLArtiste(ARTISTE_A)
    expect(liste.ok && liste.commandes.map((c) => c.numero)).toEqual([numeros[1], numeros[0], numeros[2]])
  })

  it('pages : échéance dépassée écrite sur la liste et sur la commande', async () => {
    const passage = await poser()
    await constater(passage, new Date(Date.now() - 72 * HEURE))
    const numero = await numeroDe('art-a')
    acteur.courant = ARTISTE_A as never
    const { default: Liste } = await import('@/app/dashboard/artiste/commandes/page')
    const { default: PageCommande } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    expect(texteDe(await Liste())).toContain(fr.commandesArtiste.depassee)
    expect(texteDe(await PageCommande({ params: { numero } }))).toContain(fr.commandesArtiste.depassee)
  })

  it('action serveur : acteur relu (mock), messages sans détail technique', async () => {
    const passage = await poser()
    await constater(passage)
    const numero = await numeroDe('art-a')
    const { actionPrendreEnCharge } = await import('@/app/dashboard/artiste/commandes/actions')
    acteur.courant = ARTISTE_B as never
    expect(await actionPrendreEnCharge(numero)).toEqual({ ok: false, message: fr.commandesArtiste.action.erreurs.introuvable })
    acteur.courant = ARTISTE_A as never
    expect(await actionPrendreEnCharge(numero)).toEqual({ ok: true, message: fr.commandesArtiste.action.reussi })
    expect(await actionPrendreEnCharge(numero)).toEqual({ ok: true, message: fr.commandesArtiste.action.deja })
  })
})
