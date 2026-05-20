import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cloudinary } from '@/lib/cloudinary'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
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
