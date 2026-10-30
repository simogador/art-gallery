import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { acteurCourant } from '@/lib/acces'
import { champsDimensions, champsPrix } from '@/lib/catalogue/conversions'
import { publicationInitiale } from '@/lib/curation'
import { disponibiliteInitiale } from '@/lib/disponibilite'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string): Promise<string> {
  let slug     = base
  let counter  = 2
  while (await prisma.artwork.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`
  }
  return slug
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if ((await acteurCourant()).type !== 'artist') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const artist = await prisma.artist.findFirst({
    where: { userId: session.user.id },
  })
  if (!artist) {
    return NextResponse.json({ error: 'Profil artiste introuvable' }, { status: 404 })
  }

  const body = await req.json()
  const { title, year, technique, dimensions, price, description } = body

  if (!title?.trim() || !year || !technique?.trim()) {
    return NextResponse.json({ error: 'Titre, année et technique sont requis' }, { status: 400 })
  }

  // Double écriture (AD-20) : anciennes et nouvelles colonnes, cohérentes ; refus si illisible.
  const prix = champsPrix(price)
  if (!prix.ok) return NextResponse.json({ error: prix.erreur }, { status: 400 })
  const taille = champsDimensions(dimensions)
  if (!taille.ok) return NextResponse.json({ error: taille.erreur }, { status: 400 })

  const baseSlug = await uniqueSlug(`${slugify(title)}-${year}`)

  // Story 2.2 : brouillon + disponible, absente du catalogue jusqu'à sa publication par l'équipe.
  const initiale = publicationInitiale()

  const artwork = await prisma.artwork.create({
    data: {
      slug:        baseSlug,
      title:       title.trim(),
      year:        parseInt(year, 10),
      medium:      technique.trim(),
      ...prix.champs,
      ...taille.champs,
      description: description?.trim() ?? '',
      imageUrl:    '',
      ...initiale,
      ...disponibiliteInitiale(initiale),
      featured:    false,
      artistId:    artist.id,
    },
  })

  return NextResponse.json({ slug: artwork.slug, id: artwork.id }, { status: 201 })
}
