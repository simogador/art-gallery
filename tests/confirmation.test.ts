import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.6 (FR-13, UJ-1) : confirmation de commande de l'acheteur sans compte. Lecture seule du passage par le
// jeton du cookie (états confirmé, en attente, annulé, mixte), montants par agrégat de la base, aucun
// prestataire, page rendue pour chaque cas. Base réelle.

const jar = vi.hoisted(() => ({ lus: {} as Record<string, string | undefined> }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/confirmation' }))
vi.mock('@/lib/notifications/choix', () => ({ envoiActif: () => ({ envoyer: async () => ({ ok: true }) }), choisirEnvoi: vi.fn(), envoiReel: () => false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (nom: string) => (jar.lus[nom] ? { value: jar.lus[nom] } : undefined), set: vi.fn() }),
  headers: () => ({ get: () => null }),
}))

const COORD = { email: 'claire.martin@exemple.test', nom: 'Claire Martin-Dupont', adresse: '12 rue des Lilas\n75011 Paris', telephone: '' }
const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const TOTAL = 208000
const DAY = 24 * 3_600_000

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

// Arbre renvoyé par la page : seul `Cadre` (composant local) est déroulé, les composants clients restent des éléments.
function trouver(noeud: unknown, cible: unknown, acc: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(noeud)) {
    noeud.forEach((x) => trouver(x, cible, acc))
    return acc
  }
  if (!isValidElement(noeud)) return acc
  if (noeud.type === cible) acc.push(noeud)
  if (typeof noeud.type === 'function' && noeud.type !== cible && noeud.type.name === 'Cadre') {
    return trouver((noeud.type as (p: unknown) => unknown)(noeud.props), cible, acc)
  }
  trouver((noeud.props as { children?: unknown }).children, cible, acc)
  return acc
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

describe('sans base : code, règles et dictionnaire', () => {
  it('la page et le module ne touchent ni Prisma, ni prestataire, ni formulaire, ni addition', () => {
    const SRC = path.join(__dirname, '..', 'src')
    const cibles = [...fichiers(path.join(SRC, 'app', 'confirmation')), path.join(SRC, 'lib', 'commandes', 'confirmation.ts')]
    expect(cibles.length).toBeGreaterThan(5)
    const addition = /\.reduce\(|\bsum\(|\+=|\b(prix|frais|total)\w*\s*\+|\+\s*\w*\.?(prix|frais|total)/i
    const prestataire = /stripe|paypal|mollie|adyen|payplug|square|braintree|lemonway|session_id|<form|<input|<iframe/i
    for (const f of cibles) {
      const lignes = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      expect(lignes.filter((l) => prestataire.test(l)), f).toEqual([])
      expect(lignes.filter((l) => addition.test(l)), f).toEqual([])
      if (f.includes(`${path.sep}app${path.sep}`)) expect(lignes.filter((l) => /@\/lib\/prisma|@\/generated|@prisma/.test(l)), f).toEqual([])
    }
    // Aucune écriture dans le module de lecture.
    const sourceModule = readFileSync(path.join(SRC, 'lib', 'commandes', 'confirmation.ts'), 'utf8')
    expect(sourceModule).not.toMatch(/\.(create|update|updateMany|delete|deleteMany|upsert)\(|\$executeRaw/)
  })

  it('l’ancienne page n’est plus dans les listes d’exceptions', () => {
    for (const f of ['eslint/exceptions-prisma.cjs', 'eslint/exceptions-textes.cjs', 'tests/exceptions-interface.cjs']) {
      expect(readFileSync(path.join(__dirname, '..', f), 'utf8'), f).not.toContain('src/app/confirmation')
    }
  })

  it('la confirmation est hors mesure et passe la maintenance', async () => {
    const { cheminMesurable } = await import('@/lib/mesure/regles')
    expect(cheminMesurable('/confirmation')).toBe(false)
    const { passeLaMaintenance } = await import('@/lib/reglages')
    expect(passeLaMaintenance(null, '/confirmation')).toBe(true)
    expect(passeLaMaintenance(null, '/confirmation-autre')).toBe(false)
    expect(passeLaMaintenance(null, '/confirmation/')).toBe(false)
    expect(passeLaMaintenance(null, '/confirmation/enfant')).toBe(false)
    expect(passeLaMaintenance(null, '/panier')).toBe(false)
  })

  it('dictionnaire : pas de promesse de délai, de retour ni de compte, pas de compte à rebours', () => {
    const json = JSON.stringify(fr.confirmation)
    expect(json).not.toMatch(/garantie|remboursé|gratuit|compte à rebours|\b\d+ jours?\b|créer un compte|inscri|bien reçu/i)
    expect(fr.confirmation.etats.confirmee).toBe('Confirmée')
  })
})

describe('base : lecture et page', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)

  async function oeuvre(slug: string, artiste = 'art-a') {
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
  async function poser(oeuvres: string[], maintenant?: Date) {
    const { poserPassagePublic } = await import('@/lib/commandes')
    const r = await poserPassagePublic({ coordonnees: COORD, pays: 'FR', oeuvres } as never, maintenant)
    if (!r.ok) throw new Error('attendu')
    jar.lus.passage_acheteur = r.jeton
    return r as typeof r & { jeton: string; passageId: string }
  }
  async function constater(passageId: string, montant = TOTAL) {
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    return traiterPaiementConstate(ADMIN, {
      passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: montant, constatePar: 'admin-1', constateLe: new Date(),
    } as never)
  }
  async function pageArbre() {
    const { default: Page } = await import('@/app/confirmation/page')
    return Page()
  }
  async function rendre() {
    return texteDe(await pageArbre())
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
    vi.stubEnv('LOT2_OUVERT', 'oui')
    jar.lus = {}
    for (const table of ['TentativeInscription', 'Jeton', 'Incident', 'RemboursementCommande', 'Paiement', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    for (const [id, nom] of [['art-a', 'Atelier A'], ['art-b', 'Atelier B']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), now())`,
        [id, nom],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('état global : un seul état commun, sinon mixte', async () => {
    const { etatGlobal } = await import('@/lib/commandes')
    expect(etatGlobal(['confirmee', 'confirmee'])).toBe('confirmee')
    expect(etatGlobal(['en_attente_paiement'])).toBe('en_attente')
    expect(etatGlobal(['annulee', 'annulee'])).toBe('annulee')
    expect(etatGlobal(['confirmee', 'annulee'])).toBe('mixte')
    expect(etatGlobal(['confirmee', 'en_attente_paiement'])).toBe('mixte')
  })

  it('paiement constaté : commandes confirmées, nom tel que saisi, agrégats, état confirmé', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    expect(await constater(r.passageId)).toMatchObject({ ok: true })
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    const c = await lireConfirmationPassage(r.jeton)
    expect(c).toMatchObject({ nom: 'Claire Martin-Dupont'.trim(), etat: 'confirmee' })
    expect(c?.commandes.map((x) => x.artiste).sort()).toEqual(['Atelier A', 'Atelier B'])
    for (const x of c?.commandes ?? []) {
      expect(x).toMatchObject({ etat: 'confirmee', prixCentimes: 100000, fraisCentimes: 4000, totalCentimes: 104000, delaiMinJours: 8, delaiMaxJours: 12 })
      expect(x.numero).toMatch(/^ERR-/)
    }
    expect(JSON.stringify(c)).not.toContain('exemple.test')
    const texte = await rendre()
    expect(texte).toContain('Merci, Claire Martin-Dupont.')
    expect(texte.match(new RegExp(fr.confirmation.etats.confirmee, 'g'))).toHaveLength(2)
    expect(texte).toContain(fr.confirmation.suivre)
    expect(texte).not.toContain(fr.confirmation.attente)
    expect(texte).toContain('Titre o1')
    expect(texte).not.toMatch(/créer un compte|Se connecter/i)
  })

  it('pas encore constaté : en attente, jamais « Confirmée », message par e-mail, pas de « Suivre »', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect((await lireConfirmationPassage(r.jeton))?.etat).toBe('en_attente')
    const texte = await rendre()
    expect(texte).toContain(fr.confirmation.titreAttente)
    expect(texte).toContain(fr.confirmation.attente)
    expect(texte).not.toContain(fr.confirmation.echue.texte)
    expect(texte).not.toContain(fr.confirmation.etats.confirmee)
    expect(texte).not.toContain(fr.confirmation.suivre)
    expect(texte).not.toContain('Merci')
  })

  it('commande annulée : « Annulée », message neutre, jamais « Confirmée »', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect((await lireConfirmationPassage(r.jeton))?.etat).toBe('annulee')
    const texte = await rendre()
    expect(texte).toContain(fr.confirmation.etats.annulee)
    expect(texte).toContain(fr.confirmation.annulee)
    expect(texte).not.toContain(fr.confirmation.etats.confirmee)
    expect(texte).not.toMatch(/rembours|Merci|e-mail/i)
  })

  it('passage mixte : une confirmée, une annulée, chaque carte à son état', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    await db.query(`UPDATE "Commande" SET etat = 'confirmee' WHERE "artistId" = 'art-a'`)
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE "artistId" = 'art-b'`)
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect((await lireConfirmationPassage(r.jeton))?.etat).toBe('mixte')
    const texte = await rendre()
    expect(texte).toContain('Merci')
    expect(texte.match(new RegExp(fr.confirmation.etats.confirmee, 'g'))).toHaveLength(1)
    expect(texte.match(new RegExp(fr.confirmation.etats.annulee, 'g'))).toHaveLength(1)
    expect(texte).toContain(fr.confirmation.annulee)
  })

  it('confirmée et en attente : seule la confirmée porte « Confirmée », l’attente reste annoncée', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    await poser(['o1', 'o2'])
    await db.query(`UPDATE "Commande" SET etat = 'confirmee' WHERE "artistId" = 'art-a'`)
    const texte = await rendre()
    expect(texte.match(new RegExp(fr.confirmation.etats.confirmee, 'g'))).toHaveLength(1)
    expect(texte).toContain(fr.confirmation.etats.enAttente)
    expect(texte).toContain(fr.confirmation.attente)
  })

  it('annulée et en attente : titre « pas encore confirmée », les deux messages, chaque carte à son état', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    await poser(['o1', 'o2'])
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE "artistId" = 'art-b'`)
    const texte = await rendre()
    expect(texte).toContain(fr.confirmation.titreAttente)
    expect(texte).toContain(fr.confirmation.attente)
    expect(texte).toContain(fr.confirmation.annulee)
    expect(texte).not.toMatch(/Merci|Confirmée/)
    expect(texte).toContain(fr.confirmation.etats.enAttente)
    expect(texte).toContain(fr.confirmation.etats.annulee)
  })

  it('réservation échue : « a pris fin » et « Retenter ma réservation », ni message d’e-mail ni rafraîchissement', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'], new Date(Date.now() - 40 * 60_000))
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect(await lireConfirmationPassage(r.jeton)).toMatchObject({ reservationEchue: true, etat: 'en_attente' })
    const arbre = await pageArbre()
    expect(texteDe(arbre)).toContain(fr.confirmation.echue.texte)
    expect(texteDe(arbre)).toContain(fr.confirmation.echue.retenter)
    expect(texteDe(arbre)).not.toContain(fr.confirmation.attente)
    expect(JSON.stringify(texteDe(arbre))).not.toContain('Confirmée')
    const { MiseAJourAuto } = await import('@/app/confirmation/MiseAJourAuto')
    expect(trouver(arbre, MiseAJourAuto)[0].props).toMatchObject({ enAttente: false, confirmee: false })
    const { default: Link } = await import('next/link')
    expect(trouver(arbre, Link).some((a) => (a.props as { href?: string }).href === '/commande/coordonnees')).toBe(true)
  })

  it('props des composants clients de la page selon l’état (MiseAJourAuto, CartClearer, id du titre)', async () => {
    const { MiseAJourAuto } = await import('@/app/confirmation/MiseAJourAuto')
    const { CartClearer } = await import('@/app/confirmation/CartClearer')
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    await poser(['o1', 'o2'])
    const lire = async () => {
      const arbre = await pageArbre()
      const maj = trouver(arbre, MiseAJourAuto)[0]?.props as Record<string, unknown>
      const clear = trouver(arbre, CartClearer)[0]?.props as { slugs: string[] } | undefined
      const titre = trouver(arbre, 'h1')[0]?.props as { id: string }
      expect(maj.idTitre).toBe(titre.id)
      return { maj, slugs: clear?.slugs }
    }
    // en attente
    let r = await lire()
    expect(r.maj).toMatchObject({ enAttente: true, confirmee: false, annulee: false })
    expect(r.slugs).toBeUndefined()
    // mixte : une confirmée, une en attente → rafraîchit, ne retire que la confirmée
    await db.query(`UPDATE "Commande" SET etat = 'confirmee' WHERE "artistId" = 'art-a'`)
    r = await lire()
    expect(r.maj).toMatchObject({ enAttente: true, confirmee: false })
    expect(r.slugs).toEqual(['o1'])
    // confirmé
    await db.query(`UPDATE "Commande" SET etat = 'confirmee'`)
    r = await lire()
    expect(r.maj).toMatchObject({ enAttente: false, confirmee: true, annulee: false })
    expect(r.slugs?.sort()).toEqual(['o1', 'o2'])
    // mixte confirmée + annulée : seule la confirmée est retirée
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE "artistId" = 'art-b'`)
    r = await lire()
    expect(r.maj).toMatchObject({ enAttente: false, confirmee: true, annulee: true })
    expect(r.slugs).toEqual(['o1'])
    // annulé
    await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
    r = await lire()
    expect(r.maj).toMatchObject({ enAttente: false, confirmee: false, annulee: true })
    expect(r.slugs).toBeUndefined()
  })

  it('nom : vide → « Merci. », apostrophe conservée, très long tronqué', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    await constater(r.passageId, 104000)
    await db.query(`UPDATE "CoordonneesAcheteur" SET nom = ''`)
    expect(await rendre()).toContain(`${fr.confirmation.merciSansNom} `)
    expect(await rendre()).not.toContain('Merci,')
    await db.query(`UPDATE "CoordonneesAcheteur" SET nom = 'Jeanne d''Arc'`)
    expect(await rendre()).toContain('Merci, Jeanne d\'Arc.')
    await db.query(`UPDATE "CoordonneesAcheteur" SET nom = $1`, ['N'.repeat(300)])
    const texte = await rendre()
    expect(texte).toContain(`Merci, ${'N'.repeat(60)}….`)
    expect(texte).not.toContain('N'.repeat(61))
  })

  it('paiement tardif de bout en bout (6.5) : commande annulée puis paiement constaté → « Annulée », jamais « Merci » ni « Confirmée »', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const { annulerCommande, traiterPaiementConstate } = await import('@/lib/commandes')
    const { rows } = await db.query(`SELECT id FROM "Commande"`)
    expect(await annulerCommande(ADMIN, rows[0].id)).toMatchObject({ ok: true })
    const sortie = await traiterPaiementConstate(ADMIN, {
      passageId: r.passageId, source: 'constat_manuel', referenceExterne: 'VIR-TARD', montantCentimes: 104000, constatePar: 'admin-1', constateLe: new Date(),
    } as never)
    expect(sortie).toMatchObject({ ok: true })
    expect(await compter('RemboursementCommande')).toBe(1)
    const texte = await rendre()
    expect(texte).toContain(fr.confirmation.etats.annulee)
    expect(texte).toContain(fr.confirmation.annulee)
    expect(texte).not.toMatch(/Merci|Confirmée/)
  })

  it('jeton absent, inconnu, mal formé, révoqué, trop ancien : null ; lisible 7 jours après l’échéance', async () => {
    await oeuvre('o1')
    const maintenant = new Date()
    const r = await poser(['o1'], maintenant)
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect(await lireConfirmationPassage(undefined)).toBeNull()
    expect(await lireConfirmationPassage('x'.repeat(43))).toBeNull()
    expect(await lireConfirmationPassage('court')).toBeNull()
    const echeance = new Date(maintenant.getTime() + 30 * 60_000)
    expect(await lireConfirmationPassage(r.jeton, new Date(echeance.getTime() + 6 * DAY))).not.toBeNull()
    expect(await lireConfirmationPassage(r.jeton, new Date(echeance.getTime() + 8 * DAY))).toBeNull()
    await db.query(`UPDATE "Jeton" SET "revoqueLe" = now()`)
    expect(await lireConfirmationPassage(r.jeton)).toBeNull()
  })

  it('passage sans commande : null (une commande historique n’a pas de passage)', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    await db.query(`DELETE FROM "LigneCommande"`)
    await db.query(`DELETE FROM "Commande"`)
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    expect(await lireConfirmationPassage(r.jeton)).toBeNull()
  })

  it('commande sans ligne : erreur (état de panne), jamais « aucune commande »', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    await db.query(`DELETE FROM "LigneCommande"`)
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    await expect(lireConfirmationPassage(r.jeton)).rejects.toThrow('confirmation_incoherente')
  })

  it('lecture seule : aucune ligne écrite ni modifiée par le rendu ni par la lecture', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const avant = {
      commande: await db.query(`SELECT * FROM "Commande" ORDER BY id`),
      jeton: await db.query(`SELECT * FROM "Jeton" ORDER BY id`),
      reservation: await db.query(`SELECT * FROM "Reservation" ORDER BY id`),
    }
    const compteurs = [await compter('Paiement'), await compter('Evenement'), await compter('Incident')]
    await rendre()
    const { lireConfirmationPassage } = await import('@/lib/commandes')
    await lireConfirmationPassage(r.jeton)
    expect(await db.query(`SELECT * FROM "Commande" ORDER BY id`)).toEqual(avant.commande)
    expect(await db.query(`SELECT * FROM "Jeton" ORDER BY id`)).toEqual(avant.jeton)
    expect(await db.query(`SELECT * FROM "Reservation" ORDER BY id`)).toEqual(avant.reservation)
    expect([await compter('Paiement'), await compter('Evenement'), await compter('Incident')]).toEqual(compteurs)
  })

  it('sans passage ou ancien ?session_id= : message neutre, aucun prestataire', async () => {
    const { default: Page } = await import('@/app/confirmation/page')
    const texte = texteDe(await (Page as unknown as (p: unknown) => Promise<unknown>)({ searchParams: Promise.resolve({ session_id: 'cs_test_123' }) }))
    expect(texte).toContain(fr.confirmation.inactif.titre)
    expect(texte).toContain(fr.confirmation.inactif.accueil)
    expect(texte).not.toContain(fr.confirmation.etats.confirmee)
    jar.lus.passage_acheteur = 'x'.repeat(43)
    expect(await rendre()).toContain(fr.confirmation.inactif.titre)
  })

  it('Lot 2 fermé : message neutre, rien n’est lu', async () => {
    await oeuvre('o1')
    await poser(['o1'])
    vi.stubEnv('LOT2_OUVERT', 'non')
    const texte = await rendre()
    expect(texte).toContain(fr.confirmation.ferme.titre)
    expect(texte).not.toContain('Titre o1')
  })
})
