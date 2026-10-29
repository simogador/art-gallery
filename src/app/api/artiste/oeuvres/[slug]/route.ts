import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { acteurCourant } from '@/lib/acces'
import { champsDimensionsModifiees, champsPrix } from '@/lib/catalogue/conversions'

async function getArtistArtwork(userId: string, slug: string) {
  const artist = await prisma.artist.findFirst({ where: { userId } })
  if (!artist) return null

  const artwork = await prisma.artwork.findUnique({ where: { slug } })
  if (!artwork || artwork.artistId !== artist.id) return null

  return artwork
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if ((await acteurCourant()).type !== 'artist') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { slug } = await params
  const artwork  = await getArtistArtwork(session.user.id!, slug)
  if (!artwork) {
    return NextResponse.json({ error: 'Œuvre introuvable' }, { status: 404 })
  }

  const body = await req.json()
  const { title, year, technique, dimensions, price, description } = body

  if (!title?.trim() || !year || !technique?.trim()) {
    return NextResponse.json({ error: 'Titre, année et technique sont requis' }, { status: 400 })
  }

  // Double écriture (AD-20) : anciennes et nouvelles colonnes, cohérentes ; refus si illisible.
  const prix = champsPrix(price)
  if (!prix.ok) return NextResponse.json({ error: prix.erreur }, { status: 400 })
  const taille = champsDimensionsModifiees(dimensions, artwork.dimensions)
  if (!taille.ok) return NextResponse.json({ error: taille.erreur }, { status: 400 })

  const updated = await prisma.artwork.update({
    where: { slug },
    data: {
      title:       title.trim(),
      year:        parseInt(year, 10),
      medium:      technique.trim(),
      ...prix.champs,
      ...taille.champs,
      description: description?.trim() ?? '',
    },
  })

  return NextResponse.json({ slug: updated.slug })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if ((await acteurCourant()).type !== 'artist') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { slug } = await params
  const artwork  = await getArtistArtwork(session.user.id!, slug)
  if (!artwork) {
    return NextResponse.json({ error: 'Œuvre introuvable' }, { status: 404 })
  }

  await prisma.artwork.delete({ where: { slug } })

  return NextResponse.json({ deleted: true })
}
