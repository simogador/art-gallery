import { NextRequest, NextResponse } from 'next/server'
import { cloudinary } from '@/lib/cloudinary'
import { prisma } from '@/lib/prisma'
import { acteurCourant } from '@/lib/acces'

export async function POST(req: NextRequest) {
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const artworkId = formData.get('artworkId') as string | null

  if (!file || !artworkId) {
    return NextResponse.json({ error: 'Fichier et artworkId requis' }, { status: 400 })
  }

  const artwork = await prisma.artwork.findUnique({ where: { slug: artworkId } })
  if (!artwork) {
    return NextResponse.json({ error: 'Œuvre introuvable' }, { status: 404 })
  }

  // Seul l'admin ou l'artiste propriétaire de l'œuvre peut en changer l'image.
  const autorise =
    acteur.type === 'admin' || (acteur.type === 'artist' && acteur.artiste?.id === artwork.artistId)
  if (!autorise) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder:    `errancy/artworks`,
        public_id: artworkId,
        overwrite: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload échoué'))
        else resolve(result as { secure_url: string })
      },
    ).end(buffer)
  })

  await prisma.artwork.update({
    where: { slug: artworkId },
    data:  { imageUrl: result.secure_url },
  })

  return NextResponse.json({ url: result.secure_url })
}
