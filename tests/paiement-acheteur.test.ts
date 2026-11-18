import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.4 (FR-11, FR-14, AD-4) : récapitulatif et paiement de l'acheteur sans compte. Lecture du passage
// par le jeton du cookie, montants par agrégat de la base, port d'encaissement (adaptateur factice de test),
// zone neutre sans adaptateur. Base réelle.

const jar = vi.hoisted(() => ({ lus: {} as Record<string, string | undefined> }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/commande/paiement' }))
vi.mock('@/lib/notifications/choix', () => ({ envoiActif: () => ({ envoyer: async () => ({ ok: true }) }), choisirEnvoi: vi.fn(), envoiReel: () => false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (nom: string) => (jar.lus[nom] ? { value: jar.lus[nom] } : undefined), set: vi.fn() }),
  headers: () => ({ get: () => null }),
}))

const COORD = { email: 'claire.martin@exemple.test', nom: 'Claire Martin', adresse: '12 rue des Lilas\n75011 Paris', telephone: '' }
const MIN = 60_000
// o1 et o2 : 100000 + 4000 chacune.
const TOTAL = 208000

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

describe('sans base : sélecteur et code', () => {
  it('aucun adaptateur d’encaissement configuré : le sélecteur renvoie null (OQ-1 ouverte)', async () => {
    const { adaptateurEncaissement, constatManuel } = await import('@/lib/paiement')
    expect(adaptateurEncaissement()).toBeNull()
    expect(constatManuel.ouvrir).toBeUndefined()
  })

  it('aucun composant ni la page n’additionne ; aucun nom de prestataire ni formulaire dans la page', () => {
    const SRC = path.join(__dirname, '..', 'src')
    const cibles = [...fichiers(path.join(SRC, 'app', 'commande', 'paiement')), path.join(SRC, 'lib', 'commandes', 'paiement-acheteur.ts')]
    expect(cibles.length).toBeGreaterThan(4)
    const addition = /\.reduce\(|\bsum\(|\+=|\b(prix|frais|total)\w*\s*\+|\+\s*\w*\.?(prix|frais|total)/i
    const prestataire = /stripe|paypal|mollie|adyen|payplug|square|braintree|lemonway|<form|<input|<iframe/i
    for (const f of cibles) {
      const lignes = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      expect(lignes.filter((l) => addition.test(l)), f).toEqual([])
      expect(lignes.filter((l) => prestataire.test(l)), f).toEqual([])
    }
  })

  it('la page de paiement est hors mesure', async () => {
    const { cheminMesurable } = await import('@/lib/mesure/regles')
    expect(cheminMesurable('/commande/paiement')).toBe(false)
  })

  it('dictionnaire : pas de promesse de retour ni de garantie, pas de compte à rebours', () => {
    const json = JSON.stringify(fr.paiementAcheteur)
    expect(json).not.toMatch(/garantie|remboursé|gratuit|compte à rebours|\b\d+ jours? pour|dès réception|accompagne/i)
    expect(fr.paiementAcheteur.zoneNeutre.etiquette).toBe('Le moyen de paiement en ligne n’est pas encore ouvert')
  })
})

describe('base : récapitulatif et ouverture du paiement', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)

  async function oeuvre(slug: string, artiste = 'art-a', o: { prix?: number; min?: number; max?: number } = {}) {
    const { prix = 100000, min = 5, max = 9 } = o
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $4, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste, prix],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, 3, $2, $3, 'EUR', now())`,
      [slug, min, max],
    )
  }
  async function poser(oeuvres: string[], maintenant?: Date) {
    const { poserPassagePublic } = await import('@/lib/commandes')
    const r = await poserPassagePublic({ coordonnees: COORD, pays: 'FR', oeuvres } as never, maintenant)
    if (!r.ok) throw new Error('attendu')
    jar.lus.passage = r.jeton
    return r as typeof r & { jeton: string; passageId: string }
  }
  function factice() {
    let n = 0
    return { source: 'factice', ouvrir: vi.fn(async () => ({ ok: true as const, referenceExterne: `ref-${++n}` })) }
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
    for (const table of ['TentativeInscription', 'Jeton', 'Paiement', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
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

  describe('lecture du passage', () => {
    it('deux artistes : une commande par artiste, sommes et total général lus par agrégat de la base', async () => {
      await oeuvre('o1')
      await oeuvre('o2', 'art-b')
      const r = await poser(['o1', 'o2'])
      const { lireRecapitulatifPaiement } = await import('@/lib/commandes')
      const rec = await lireRecapitulatifPaiement(r.jeton)
      expect(rec).not.toBeNull()
      expect(rec?.commandes.map((c) => c.artiste).sort()).toEqual(['Atelier A', 'Atelier B'])
      for (const c of rec?.commandes ?? []) {
        expect(c).toMatchObject({ prixCentimes: 100000, fraisCentimes: 4000, totalCentimes: 104000, delaiMinJours: 8, delaiMaxJours: 12 })
        expect(c.lignes).toHaveLength(1)
      }
      expect(rec).toMatchObject({ totalCentimes: TOTAL, devise: 'EUR', echue: false })
    })

    it('deux œuvres du même artiste, délais différents : prix et frais sommés, plus long minimum et plus long maximum', async () => {
      await oeuvre('o1', 'art-a', { prix: 100000, min: 5, max: 9 })
      await oeuvre('o2', 'art-a', { prix: 50000, min: 10, max: 20 })
      const r = await poser(['o1', 'o2'])
      const { lireRecapitulatifPaiement } = await import('@/lib/commandes')
      const rec = await lireRecapitulatifPaiement(r.jeton)
      expect(rec?.commandes).toHaveLength(1)
      expect(rec?.commandes[0]).toMatchObject({ prixCentimes: 150000, fraisCentimes: 8000, totalCentimes: 158000, delaiMinJours: 13, delaiMaxJours: 23 })
      expect(rec?.commandes[0].lignes).toHaveLength(2)
      expect(rec?.totalCentimes).toBe(158000)
    })

    it('une commande annulée n’y figure jamais ni dans le total', async () => {
      await oeuvre('o1')
      await oeuvre('o2', 'art-b')
      const r = await poser(['o1', 'o2'])
      await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE "artistId" = 'art-b'`)
      const { lireRecapitulatifPaiement } = await import('@/lib/commandes')
      const rec = await lireRecapitulatifPaiement(r.jeton)
      expect(rec?.commandes).toHaveLength(1)
      expect(rec?.totalCentimes).toBe(104000)
    })

    it('commande sans ligne : erreur (état de panne), jamais « aucune commande à payer »', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      await db.query(`DELETE FROM "LigneCommande"`)
      const { lireRecapitulatifPaiement } = await import('@/lib/commandes')
      await expect(lireRecapitulatifPaiement(r.jeton)).rejects.toThrow('recapitulatif_incoherent')
    })

    it('jeton absent, inconnu, passage payé, annulé, abandonné : null', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const { lireRecapitulatifPaiement, annulerPassagePublic } = await import('@/lib/commandes')
      expect(await lireRecapitulatifPaiement(undefined)).toBeNull()
      expect(await lireRecapitulatifPaiement('x'.repeat(43))).toBeNull()
      await db.query(`UPDATE "Commande" SET "abandonneLe" = now() - interval '1 hour'`)
      expect(await lireRecapitulatifPaiement(r.jeton)).toBeNull()
      await db.query(`UPDATE "Commande" SET "abandonneLe" = NULL, etat = 'confirmee'`)
      expect(await lireRecapitulatifPaiement(r.jeton)).toBeNull()
      await db.query(`UPDATE "Commande" SET etat = 'en_attente_paiement'`)
      expect(await lireRecapitulatifPaiement(r.jeton)).not.toBeNull()
      expect(await annulerPassagePublic(r.jeton)).toMatchObject({ ok: true })
      expect(await lireRecapitulatifPaiement(r.jeton)).toBeNull()
    })
  })

  describe('ouvrir un paiement', () => {
    it('sans adaptateur (aujourd’hui) : refus avant toute lecture ou écriture, aucun Paiement', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const { prisma } = await import('@/lib/prisma')
      const espions = [
        vi.spyOn(prisma, '$transaction'),
        vi.spyOn(prisma.commande, 'findMany'),
        vi.spyOn(prisma.paiement, 'findFirst'),
        vi.spyOn(prisma.paiement, 'create'),
        vi.spyOn(prisma.jeton, 'findFirst'),
        vi.spyOn(prisma.jeton, 'findUnique'),
      ]
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton)).toEqual({ ok: false, code: 'aucun_adaptateur' })
      for (const e of espions) expect(e).not.toHaveBeenCalled()
      expect(await compter('Paiement')).toBe(0)
    })

    it('Lot 2 fermé : refus avant tout, aucun Paiement, l’adaptateur n’est pas appelé', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      vi.stubEnv('LOT2_OUVERT', '')
      const a = factice()
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'ferme' })
      expect(a.ouvrir).not.toHaveBeenCalled()
      expect(await compter('Paiement')).toBe(0)
    })

    it('adaptateur factice : un Paiement ouvert au total du passage lu par agrégat, repris au second appel sans rappeler l’adaptateur', async () => {
      await oeuvre('o1')
      await oeuvre('o2', 'art-b')
      const r = await poser(['o1', 'o2'])
      const a = factice()
      const { ouvrirPaiement } = await import('@/lib/commandes')
      const premier = await ouvrirPaiement(r.jeton, { adaptateur: a })
      expect(premier).toMatchObject({ ok: true, montantCentimes: TOTAL, devise: 'EUR', referenceExterne: 'ref-1', reutilise: false })
      expect(a.ouvrir).toHaveBeenCalledWith({ passageId: r.passageId, montantCentimes: TOTAL, devise: 'EUR' })
      const lignes = (await db.query(`SELECT source, "montantCentimes", etat::text AS etat, "passageId" FROM "Paiement"`)).rows
      expect(lignes).toEqual([{ source: 'factice', montantCentimes: TOTAL, etat: 'ouvert', passageId: r.passageId }])
      const second = await ouvrirPaiement(r.jeton, { adaptateur: a })
      expect(second).toMatchObject({ ok: true, reutilise: true, paiementId: premier.ok ? premier.paiementId : '' })
      expect(a.ouvrir).toHaveBeenCalledTimes(1)
      expect(await compter('Paiement')).toBe(1)
    })

    it('deux ouvertures simultanées : l’adaptateur est appelé une seule fois, un seul Paiement ouvert', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const a = factice()
      const { ouvrirPaiement } = await import('@/lib/commandes')
      const resultats = await Promise.all([ouvrirPaiement(r.jeton, { adaptateur: a }), ouvrirPaiement(r.jeton, { adaptateur: a })])
      expect(resultats.every((x) => x.ok)).toBe(true)
      expect(a.ouvrir).toHaveBeenCalledTimes(1)
      expect(await compter('Paiement', `WHERE etat = 'ouvert'`)).toBe(1)
    })

    it('Paiement ouvert d’une autre source (constat manuel) ou d’un autre montant : refus, rien n’est écrasé', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      await db.query(
        `INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", etat, "updatedAt")
         VALUES ('pay-manuel', $1, 'constat_manuel', 'VIR-1', 104000, 'ouvert', now())`,
        [r.passageId],
      )
      const a = factice()
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'paiement_deja_ouvert' })
      expect(a.ouvrir).not.toHaveBeenCalled()
      await db.query(`UPDATE "Paiement" SET source = 'factice', "montantCentimes" = 5000`)
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'paiement_deja_ouvert' })
      expect((await db.query(`SELECT source, "referenceExterne", "montantCentimes" FROM "Paiement"`)).rows).toEqual([
        { source: 'factice', referenceExterne: 'VIR-1', montantCentimes: 5000 },
      ])
    })

    it('le total change pendant l’appel de l’adaptateur : refus total_change, rien créé', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const a = {
        source: 'factice',
        ouvrir: vi.fn(async () => {
          await db.query(`UPDATE "LigneCommande" SET "fraisCentimes" = 5000, "totalCentimes" = 105000`)
          return { ok: true as const, referenceExterne: 'ref-x' }
        }),
      }
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'total_change' })
      expect(await compter('Paiement')).toBe(0)
    })

    it('la réservation échoit pendant l’appel de l’adaptateur : refus echue sous verrou, rien créé', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const a = {
        source: 'factice',
        ouvrir: vi.fn(async () => {
          await db.query(`UPDATE "Reservation" SET echeance = now() - interval '1 minute'`)
          return { ok: true as const, referenceExterne: 'ref-x' }
        }),
      }
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'echue' })
      expect(await compter('Paiement')).toBe(0)
    })

    it('passage abandonné (aucune commande en attente), montant nul ou au-dessus du maximum : refus, adaptateur non appelé', async () => {
      await oeuvre('o1')
      await oeuvre('o2', 'art-b')
      const r = await poser(['o1', 'o2'])
      const a = factice()
      const { ouvrirPaiement } = await import('@/lib/commandes')
      await db.query(`UPDATE "LigneCommande" SET "prixCentimes" = 0, "fraisCentimes" = 0, "totalCentimes" = 0`)
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'refuse' })
      await db.query(`UPDATE "LigneCommande" SET "prixCentimes" = 1500000000, "totalCentimes" = 1500000000`)
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'refuse' })
      await db.query(`UPDATE "Commande" SET "abandonneLe" = now() - interval '1 hour'`)
      expect(await ouvrirPaiement(r.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'introuvable' })
      expect(a.ouvrir).not.toHaveBeenCalled()
      expect(await compter('Paiement')).toBe(0)
    })

    it('adaptateur qui refuse ou échoue : refus sans détail, aucun Paiement', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      const { ouvrirPaiement } = await import('@/lib/commandes')
      expect(await ouvrirPaiement(r.jeton, { adaptateur: { source: 'factice', ouvrir: async () => ({ ok: false }) } })).toEqual({ ok: false, code: 'refuse' })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const panne = { source: 'factice', ouvrir: async () => { throw new Error('boum jeton secret') } }
      expect(await ouvrirPaiement(r.jeton, { adaptateur: panne })).toEqual({ ok: false, code: 'refuse' })
      expect(await compter('Paiement')).toBe(0)
      expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toMatch(/secret|exemple\.test/)
    })

    it('passage inconnu, payé, annulé ou réservation échue : refus, aucun Paiement', async () => {
      await oeuvre('o1')
      const { ouvrirPaiement } = await import('@/lib/commandes')
      const a = factice()
      expect(await ouvrirPaiement(undefined, { adaptateur: a })).toEqual({ ok: false, code: 'introuvable' })
      const echu = await poser(['o1'], new Date(Date.now() - 40 * MIN))
      expect(await ouvrirPaiement(echu.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'echue' })
      await db.query(`UPDATE "Commande" SET etat = 'confirmee'`)
      expect(await ouvrirPaiement(echu.jeton, { adaptateur: a })).toEqual({ ok: false, code: 'introuvable' })
      expect(a.ouvrir).not.toHaveBeenCalled()
      expect(await compter('Paiement')).toBe(0)
    })
  })

  describe('page /commande/paiement', () => {
    const page = async () => (await import('@/app/commande/paiement/page')).default()

    it('Lot 2 fermé : message d’ouverture prochaine, lien vers le panier, rien d’autre', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      jar.lus.passage = r.jeton
      vi.stubEnv('LOT2_OUVERT', '')
      const html = renderToStaticMarkup((await page()) as never)
      expect(texteDe(await page())).toContain(fr.paiementAcheteur.ferme.titre)
      expect(html).toContain('href="/panier"')
      expect(html).not.toContain(fr.paiementAcheteur.zoneNeutre.etiquette)
      expect(await compter('Paiement')).toBe(0)
    })

    it('passage inconnu, payé ou annulé : message neutre et lien vers le panier', async () => {
      await oeuvre('o1')
      expect(texteDe(await page())).toContain(fr.paiementAcheteur.inactif.titre)
      expect(renderToStaticMarkup((await page()) as never)).not.toContain('href="/commande"')
      jar.lus.commande = 'jeton-equipe'
      const equipe = renderToStaticMarkup((await page()) as never)
      expect(equipe).toContain('href="/commande"')
      expect(equipe).toContain(fr.paiementAcheteur.inactif.commande)
      delete jar.lus.commande
      const r = await poser(['o1'])
      jar.lus.passage = r.jeton
      await db.query(`UPDATE "Commande" SET etat = 'confirmee'`)
      const html = renderToStaticMarkup((await page()) as never)
      expect(html).toContain(fr.paiementAcheteur.inactif.titre)
      expect(html).toContain('href="/panier"')
      expect(await compter('Paiement')).toBe(0)
    })

    it('passage valide sans adaptateur : récapitulatif, total général, droits, zone neutre sans formulaire, aucun Paiement', async () => {
      await oeuvre('o1')
      await oeuvre('o2', 'art-b')
      const r = await poser(['o1', 'o2'])
      const numeros = (await db.query(`SELECT numero FROM "Commande" ORDER BY numero`)).rows.map((x) => x.numero as string)
      const html = renderToStaticMarkup((await page()) as never)
      const texte = texteDe(await page())
      expect(texte).toContain('Titre o1')
      expect(texte).toContain('Atelier A')
      expect(texte).toContain('Atelier B')
      expect(texte).toContain('1 040 €')
      expect(texte).toContain('2 080 €')
      expect(texte).toContain('1 040 € + 1 040 €')
      expect(texte).toContain(fr.paiementAcheteur.colis(2, ['8 à 12 jours', '8 à 12 jours']).replace(/\s+/g, ' '))
      expect(texte).toContain(fr.livraison.droitsNonInclus)
      expect(texte).toContain(fr.paiementAcheteur.zoneNeutre.etiquette)
      expect(texte).toContain(fr.paiementAcheteur.conditions.texte)
      for (const n of numeros) expect(texte).toContain(n)
      expect(html).not.toMatch(/<form|<input|<iframe/)
      expect(texte).toContain(fr.paiementAcheteur.zoneNeutre.avantLaFin)
      // Bouton Conseil réel (aucun numéro WhatsApp réglé : repli vers /conseil).
      expect(html).toContain('href="/conseil"')
      expect(texte).toContain(fr.conseilWhatsApp.repliLibelle)
      expect(html).toContain('aria-hidden="true"')
      expect(html).not.toContain('<a href="/cgv"')
      expect(html).toContain('/commande/coordonnees')
      expect(await compter('Paiement')).toBe(0)
      void r
    })

    it('lecture impossible (commande sans ligne) : état de panne, jamais « aucune commande à payer »', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      jar.lus.passage = r.jeton
      await db.query(`DELETE FROM "LigneCommande"`)
      const texte = texteDe(await page())
      expect(texte).toContain(fr.paiementAcheteur.panne)
      expect(texte).not.toContain(fr.paiementAcheteur.inactif.titre)
    })

    it('la page ne fait que lire : aucun Paiement créé même avec le Lot 2 ouvert et un passage valide', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      jar.lus.passage = r.jeton
      await page()
      expect(await compter('Paiement')).toBe(0)
    })

    it('réservation échue : « a pris fin » (client) et renvoi vers les coordonnées, pas de zone de paiement', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'], new Date(Date.now() - 40 * MIN))
      jar.lus.passage = r.jeton
      const html = renderToStaticMarkup((await page()) as never)
      expect(html).toContain('href="/commande/coordonnees"')
      expect(texteDe(await page())).toContain(fr.paiementAcheteur.echue.texte)
      expect(html).not.toContain(fr.paiementAcheteur.zoneNeutre.etiquette)
      expect(await compter('Paiement')).toBe(0)
    })
  })
})
