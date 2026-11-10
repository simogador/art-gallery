import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { formaterMontant } from '@/lib/i18n'
import { lireFicheArtiste, LIMITES_FICHE_ARTISTE, refusFichierArtiste } from '@/lib/curation/fiche-artiste-regles'
import { createHash } from 'node:crypto'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 3.11 (FR-19, FR-8, OQ-14) : pages artistes gérées par l'équipe — saisie, photos signées,
// page complète / sections absentes, œuvres disponibles avec prix livré, aucune coordonnée.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/navigation', () => ({ useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))
const detruire = vi.hoisted(() => vi.fn(async () => ({ result: 'ok' })))
const signer = vi.hoisted(() => vi.fn((_p: unknown, secret: string) => `signe-${secret}`))
vi.mock('@/lib/cloudinary', () => ({
  cloudinary: {
    utils: { api_sign_request: signer },
    uploader: { destroy: detruire },
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const ARTISTE = { type: 'artist', userId: 'u1', artiste: { id: 'ana', slug: 'ana', name: 'Ana' } } as never
const VISITEUR = { type: 'visiteur' } as never
const SECRET = 'secret-de-test'
const NUAGE = 'nuage-test'

describe('lireFicheArtiste (règles pures)', () => {
  it('biographie obligatoire, le reste facultatif (vide = effacé), textes nettoyés', () => {
    expect(lireFicheArtiste({ bio: '  Née à Fès.  ', statement: '', formation: ' ', expositions: 'A\r\nB' })).toEqual({
      ok: true,
      champs: { bio: 'Née à Fès.', statement: null, formation: null, expositions: 'A\nB' },
    })
    const sans = lireFicheArtiste({ bio: '   ' })
    expect(sans.ok).toBe(false)
  })

  it('refuse un texte trop long et une valeur qui n’est pas du texte', () => {
    const long = lireFicheArtiste({ bio: 'x', formation: 'y'.repeat(LIMITES_FICHE_ARTISTE.formation + 1) })
    expect(long).toMatchObject({ ok: false })
    expect(!long.ok && long.erreur).toContain('Formation')
    expect(lireFicheArtiste({ bio: 'x', statement: 12 })).toMatchObject({ ok: false })
  })
})

describe('contrôles purs', () => {
  it('retire le nul et les contrôles sans lever', () => {
    expect(lireFicheArtiste({ bio: 'a\u0000b\u0007c\td\ne' })).toMatchObject({ ok: true, champs: { bio: 'abc\td\ne' } })
    expect(lireFicheArtiste({ bio: '\u0000 \u0001' })).toMatchObject({ ok: false })
  })

  it('refusFichierArtiste : type, extension si type vide (HEIC), poids', () => {
    const f = (type: string, name: string, size = 1000) => refusFichierArtiste({ type, name, size })
    expect(f('image/jpeg', 'a.jpg')).toBeNull()
    expect(f('', 'IMG_1.HEIC')).toBeNull()
    expect(f('', 'notes.pdf')).not.toBeNull()
    expect(f('video/mp4', 'a.mp4')).not.toBeNull()
    expect(f('image/png', 'a.png', 10 * 1024 * 1024 + 1)).not.toBeNull()
  })
})

describe('base : pages artistes', () => {
  let base: BaseJetable
  let db: Client

  const artiste = async (id = 'ana') => (await db.query(`SELECT * FROM "Artist" WHERE id = $1`, [id])).rows[0]

  async function oeuvre(slug: string, dispo: string, artistId = 'ana') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $1, 2024, 'Huile sur toile', 'Description', '', 100000, 'EUR', 610, 760, 'publiee', $2::"Disponibilite", $3, now())`,
      [slug, dispo, artistId],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'z-ue', true, 20000, 3, 4, 8, 'EUR', now())`,
      [slug],
    )
  }

  // Réponse de Cloudinary telle que le navigateur la transmet (signature authentique).
  function reponse(publicId: string, extra: Record<string, unknown> = {}) {
    const version = '1700000000'
    return {
      public_id: publicId,
      version,
      signature: createHash('sha1').update(`public_id=${publicId}&version=${version}${SECRET}`).digest('hex'),
      secure_url: `https://res.cloudinary.com/${NUAGE}/image/upload/v${version}/${publicId}.jpg`,
      resource_type: 'image',
      format: 'jpg',
      bytes: 200_000,
      ...extra,
    }
  }

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = NUAGE
    process.env.CLOUDINARY_API_KEY = 'cle'
    process.env.CLOUDINARY_API_SECRET = SECRET
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", website, "accordSigneLe", "updatedAt")
       VALUES ('ana', 'ana', 'Ana', 'Maroc', 1980, 'Bio initiale', 'https://res.cloudinary.com/ancien.jpg', 'https://ana-secret.example', now(), now()),
              ('sans-accord', 'sans-accord', 'Sans Accord', 'Pérou', 1980, 'Bio', '', null, null, now())`,
    )
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('z-ue', 'ue', now()), ('z-am', 'am', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'z-ue'), ('US', 'z-am')`)
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    detruire.mockClear()
    await db.query('DELETE FROM "OffreLivraison"')
    await db.query('DELETE FROM "Artwork"')
    await db.query(
      `UPDATE "Artist" SET bio = 'Bio initiale', statement = NULL, formation = NULL, expositions = NULL, "atelierUrl" = NULL,
         "imageUrl" = 'https://res.cloudinary.com/ancien.jpg' WHERE id = 'ana'`,
    )
  })

  describe('saisie par l’équipe', () => {
    it('l’admin enregistre biographie, démarche, formation et expositions ; vide efface', async () => {
      const { enregistrerFichePublique } = await import('@/lib/curation')
      const r = await enregistrerFichePublique(ADMIN, 'ana', { bio: 'Nouvelle bio', statement: 'Démarche', formation: 'Beaux-Arts', expositions: '2024 — Paris' })
      expect(r).toMatchObject({ ok: true })
      expect(await artiste()).toMatchObject({ bio: 'Nouvelle bio', statement: 'Démarche', formation: 'Beaux-Arts', expositions: '2024 — Paris' })
      await enregistrerFichePublique(ADMIN, 'ana', { bio: 'Nouvelle bio', statement: '', formation: '', expositions: '' })
      expect(await artiste()).toMatchObject({ statement: null, formation: null, expositions: null })
    })

    it('refuse un non-admin, un artiste inconnu et une valeur invalide, sans rien écrire', async () => {
      const { enregistrerFichePublique } = await import('@/lib/curation')
      for (const a of [ARTISTE, VISITEUR, { type: 'user', userId: 'u' } as never]) {
        expect(await enregistrerFichePublique(a, 'ana', { bio: 'Pirate' })).toEqual({ ok: false, code: 'acces_refuse' })
      }
      expect(await enregistrerFichePublique(ADMIN, 'inconnu', { bio: 'x' })).toEqual({ ok: false, code: 'introuvable' })
      expect(await enregistrerFichePublique(ADMIN, 'ana', { bio: '' })).toMatchObject({ ok: false, code: 'valeur_invalide' })
      expect((await artiste()).bio).toBe('Bio initiale')
    })

    it('un texte avec caractère nul est nettoyé, sans exception', async () => {
      const { enregistrerFichePublique } = await import('@/lib/curation')
      expect(await enregistrerFichePublique(ADMIN, 'ana', { bio: 'Bio\u0000 propre' })).toMatchObject({ ok: true })
      expect((await artiste()).bio).toBe('Bio propre')
    })
  })

  describe('photos', () => {
    it('envoi signé sous errancy/artistes/<id>/, admin seulement', async () => {
      const { preparerEnvoiPhotoArtiste } = await import('@/lib/curation')
      const r = await preparerEnvoiPhotoArtiste(ADMIN, 'ana', 'atelier')
      expect(r.ok && r.envoi.publicId).toMatch(/^errancy\/artistes\/ana\/atelier-[0-9a-f]{8}$/)
      expect(r.ok && r.envoi.folder).toBe('errancy/artistes/ana')
      expect(await preparerEnvoiPhotoArtiste(ARTISTE, 'ana', 'portrait')).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await preparerEnvoiPhotoArtiste(ADMIN, 'inconnu', 'portrait')).toEqual({ ok: false, code: 'introuvable' })
      expect(await preparerEnvoiPhotoArtiste(ADMIN, 'ana', 'couverture')).toEqual({ ok: false, code: 'valeur_invalide' })
      // Signature : exactement public_id, timestamp et allowed_formats.
      signer.mockClear()
      await preparerEnvoiPhotoArtiste(ADMIN, 'ana', 'portrait')
      expect(Object.keys(signer.mock.calls[0][0] as object).sort()).toEqual(['allowed_formats', 'public_id', 'timestamp'])
    })

    it('perte de course ou échec d’écriture : le nouveau fichier est supprimé, l’ancienne photo reste', async () => {
      const { enregistrerPhotoArtiste } = await import('@/lib/curation')
      const { prisma } = await import('@/lib/prisma')
      const ancienne = (await artiste()).imageUrl
      const nouveau = 'errancy/artistes/ana/portrait-0a1b2c3d'
      // Course : la colonne change entre la lecture et l'écriture.
      const original = prisma.artist.updateMany.bind(prisma.artist)
      const espion = vi.spyOn(prisma.artist, 'updateMany').mockImplementationOnce(async (args) => {
        await db.query(`UPDATE "Artist" SET "imageUrl" = 'https://res.cloudinary.com/autre.jpg' WHERE id = 'ana'`)
        return original(args)
      })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(nouveau))).toMatchObject({ ok: false })
      expect(detruire).toHaveBeenCalledWith(nouveau, expect.anything())
      expect((await artiste()).imageUrl).toBe('https://res.cloudinary.com/autre.jpg')
      // Échec d'écriture : pas d'exception, fichier supprimé.
      detruire.mockClear()
      espion.mockRejectedValueOnce(new Error('base indisponible'))
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(nouveau))).toMatchObject({ ok: false })
      expect(detruire).toHaveBeenCalledWith(nouveau, expect.anything())
      espion.mockRestore()
      expect(ancienne).toBeTruthy()
    })

    it('enregistre la photo d’atelier et le portrait après vérification de la réponse', async () => {
      const { enregistrerPhotoArtiste } = await import('@/lib/curation')
      const atelier = 'errancy/artistes/ana/atelier-0a1b2c3d'
      const r = await enregistrerPhotoArtiste(ADMIN, 'ana', 'atelier', reponse(atelier))
      expect(r).toMatchObject({ ok: true, cible: 'atelier' })
      expect((await artiste()).atelierUrl).toContain(atelier)
      const portrait = 'errancy/artistes/ana/portrait-0a1b2c3d'
      await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(portrait))
      expect((await artiste()).imageUrl).toContain(portrait)
      // L'ancienne photo n'est pas détruite (la page publique reste en cache 60 s).
      const autre = 'errancy/artistes/ana/atelier-ffffffff'
      await enregistrerPhotoArtiste(ADMIN, 'ana', 'atelier', reponse(autre))
      expect((await artiste()).atelierUrl).toContain(autre)
      expect(detruire).not.toHaveBeenCalled()
    })

    it('refuse une réponse falsifiée, d’un autre dossier, non conforme ou d’un non-admin : l’ancienne photo reste', async () => {
      const { enregistrerPhotoArtiste } = await import('@/lib/curation')
      const ancienne = (await artiste()).imageUrl
      const bon = 'errancy/artistes/ana/portrait-0a1b2c3d'
      expect(await enregistrerPhotoArtiste(ARTISTE, 'ana', 'portrait', reponse(bon))).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', { ...reponse(bon), signature: 'faux' })).toMatchObject({ code: 'signature_invalide' })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(bon, { secure_url: 'https://exemple.test/x.jpg' }))).toMatchObject({ code: 'signature_invalide' })
      // Dossier d'un autre artiste, ou case différente.
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse('errancy/artistes/autre/portrait-0a1b2c3d'))).toMatchObject({ code: 'signature_invalide' })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse('errancy/artistes/ana/atelier-0a1b2c3d'))).toMatchObject({ code: 'signature_invalide' })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', null)).toMatchObject({ code: 'signature_invalide' })
      // Trop lourde ou mauvais format : refusée puis supprimée de Cloudinary.
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(bon, { bytes: 11 * 1024 * 1024 }))).toMatchObject({ code: 'fichier_refuse' })
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'portrait', reponse(bon, { format: 'pdf' }))).toMatchObject({ code: 'fichier_refuse' })
      expect(detruire).toHaveBeenCalledTimes(2)
      expect((await artiste()).imageUrl).toBe(ancienne)
      expect(await enregistrerPhotoArtiste(ADMIN, 'ana', 'couverture', reponse(bon))).toMatchObject({ code: 'valeur_invalide' })
    })
  })

  describe('lecture publique', () => {
    it('œuvres disponibles seulement, avec prix livré et délai ; vendues, retirées et autres artistes absents', async () => {
      await oeuvre('dispo', 'disponible')
      await oeuvre('vendue', 'vendue')
      await oeuvre('retiree', 'retiree')
      const { getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
      const oeuvres = await getArtistArtworksBySlug('ana', 'FR')
      expect(oeuvres.map((o) => o.id)).toEqual(['dispo'])
      expect(oeuvres[0].prixLivre).toMatchObject({ livree: true, totalCentimes: 120_000, delaiMinJours: 7, delaiMaxJours: 11 })
      // Pays sans zone : non livrée.
      expect((await getArtistArtworksBySlug('ana', 'JP'))[0].prixLivre).toMatchObject({ livree: false })
      expect(await getArtistBySlug('ana')).not.toBeNull()
    })

    it('artiste sans accord ou inactif : introuvable (404)', async () => {
      await oeuvre('o-sans-accord', 'disponible', 'sans-accord')
      const { getArtistBySlug } = await import('@/lib/catalogue')
      expect(await getArtistBySlug('sans-accord')).toBeNull()
      await oeuvre('o-ana', 'disponible')
      await db.query(`UPDATE "Artist" SET active = false WHERE id = 'ana'`)
      expect(await getArtistBySlug('ana')).toBeNull()
      await db.query(`UPDATE "Artist" SET active = true WHERE id = 'ana'`)
    })

    it('page complète : tous les éléments ; aucune coordonnée, aucun chiffre déduit', async () => {
      await oeuvre('dispo', 'disponible')
      await db.query(
        `UPDATE "Artist" SET statement = 'Ma démarche', formation = 'Beaux-Arts de Tétouan', expositions = '2024 Paris', "atelierUrl" = $1,
           "imageUrl" = $2 WHERE id = 'ana'`,
        [`https://res.cloudinary.com/${NUAGE}/image/upload/v1/errancy/artistes/ana/atelier-0a1b2c3d.jpg`, `https://res.cloudinary.com/${NUAGE}/image/upload/v1/errancy/artistes/ana/portrait-0a1b2c3d.jpg`],
      )
      const { getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
      const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
      const artist = (await getArtistBySlug('ana'))!
      const html = renderToStaticMarkup(
        createElement(ArtistProfile, { artist, artworks: await getArtistArtworksBySlug('ana', 'FR'), pays: { code: 'FR', nom: 'France' } }),
      )
      for (const t of ['Ana', 'Bio initiale', 'Démarche', 'Ma démarche', 'Formation', 'Beaux-Arts de Tétouan', 'Expositions', '2024 Paris', 'L’atelier', 'Sélectionné par Errancy', 'Œuvres disponibles', formaterMontant(120_000), 'Livrée sous 7 à 11 jours', 'Portrait de Ana']) {
        expect(html, t).toContain(t)
      }
      expect(html).toMatch(/atelier-0a1b2c3d/)
      expect(html).not.toMatch(/ana-secret|website|@|Actif depuis|Représenté|Contacter/i)
      expect(JSON.stringify(artist)).not.toMatch(/ana-secret|website/)
    })

    it('sections vides absentes ; aucune œuvre disponible : pas de section d’œuvres', async () => {
      await oeuvre('vendue', 'vendue')
      await oeuvre('autre-vendue', 'vendue')
      // Une œuvre visible (vendue) suffit à rendre l'artiste public.
      const { getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
      const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
      const artist = (await getArtistBySlug('ana'))!
      const artworks = await getArtistArtworksBySlug('ana', 'FR')
      expect(artworks).toEqual([])
      const html = renderToStaticMarkup(createElement(ArtistProfile, { artist, artworks, pays: { code: 'FR', nom: 'France' } }))
      expect(html).toContain('Bio initiale')
      for (const absent of ['Démarche', 'Formation', 'Expositions', 'atelier', 'Œuvres disponibles']) {
        expect(html, absent).not.toContain(absent)
      }
    })

    it('coordonnées : ni e-mail du compte lié, ni site, ni mailto, dans le HTML ni les métadonnées', async () => {
      await oeuvre('dispo', 'disponible')
      await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('u-ana', 'ana@secret.test', 'artist', now())`)
      await db.query(`UPDATE "Artist" SET "userId" = 'u-ana' WHERE id = 'ana'`)
      try {
        const { getAllArtists, getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
        const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
        const { ArtistsList } = await import('@/app/artistes/ArtistsList')
        const { generateMetadata } = await import('@/app/artistes/[id]/page')
        const artist = (await getArtistBySlug('ana'))!
        const pages = [
          renderToStaticMarkup(createElement(ArtistProfile, { artist, artworks: await getArtistArtworksBySlug('ana', 'FR'), pays: { code: 'FR', nom: 'France' } })),
          renderToStaticMarkup(createElement(ArtistsList, { artists: await getAllArtists() })),
          JSON.stringify(await generateMetadata({ params: { id: 'ana' } })),
        ]
        for (const p of pages) expect(p).not.toMatch(/ana@secret|secret\.test|mailto:|ana-secret/i)
      } finally {
        await db.query(`UPDATE "Artist" SET "userId" = NULL WHERE id = 'ana'`)
        await db.query(`DELETE FROM "User" WHERE id = 'u-ana'`)
      }
    })

    it('pays non livré : « Pas de livraison vers Japon », ni montant ni délai', async () => {
      await oeuvre('dispo', 'disponible')
      const { getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
      const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
      const html = renderToStaticMarkup(
        createElement(ArtistProfile, { artist: (await getArtistBySlug('ana'))!, artworks: await getArtistArtworksBySlug('ana', 'JP'), pays: { code: 'JP', nom: 'Japon' } }),
      )
      // Libellé de la vignette de la galerie (fr.livraison.pasDeLivraison).
      expect(html).toContain('Pas de livraison vers ce pays (Japon)')
      expect(html).not.toContain(formaterMontant(120_000))
      expect(html).not.toContain('Livrée sous')
    })

    it.each([
      ['statement', 'Démarche'],
      ['formation', 'Formation'],
      ['expositions', 'Expositions'],
      ['"atelierUrl"', 'L’atelier'],
    ])('un seul champ vide (%s) : seule sa section manque', async (colonne, titre) => {
      await oeuvre('dispo', 'disponible')
      const atelier = `https://res.cloudinary.com/${NUAGE}/image/upload/v1/errancy/artistes/ana/atelier-0a1b2c3d.jpg`
      await db.query(`UPDATE "Artist" SET statement = 'S', formation = 'F', expositions = 'E', "atelierUrl" = $1 WHERE id = 'ana'`, [atelier])
      for (const vide of [null, '   ']) {
        await db.query(`UPDATE "Artist" SET ${colonne} = $1 WHERE id = 'ana'`, [vide])
        const { getArtistArtworksBySlug, getArtistBySlug } = await import('@/lib/catalogue')
        const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
        const artist = (await getArtistBySlug('ana'))!
        const html = renderToStaticMarkup(createElement(ArtistProfile, { artist, artworks: await getArtistArtworksBySlug('ana', 'FR'), pays: { code: 'FR', nom: 'France' } }))
        for (const t of ['Démarche', 'Formation', 'Expositions', 'L’atelier']) {
          if (t === titre && (colonne !== '"atelierUrl"' || vide === null)) expect(html, t).not.toContain(`>${t}<`)
          else if (t !== titre) expect(html, t).toContain(`>${t}<`)
        }
      }
    })

    it('liste : artistes publics seulement, sans chiffre inventé', async () => {
      await oeuvre('dispo', 'disponible')
      await oeuvre('o-sans-accord', 'disponible', 'sans-accord')
      const { getAllArtists } = await import('@/lib/catalogue')
      const { ArtistsList } = await import('@/app/artistes/ArtistsList')
      const artists = await getAllArtists()
      expect(artists.map((a) => a.id)).toEqual(['ana'])
      const html = renderToStaticMarkup(createElement(ArtistsList, { artists }))
      expect(html).toContain('Ana')
      expect(html).toContain('Sélectionné par Errancy')
      expect(html).not.toContain('Sans Accord')
      expect(html).not.toMatch(/Actif depuis|années|\d{4}\s*—|ana-secret/)
      expect(renderToStaticMarkup(createElement(ArtistsList, { artists: [] }))).toContain('Les premiers artistes')
    })
  })
})
