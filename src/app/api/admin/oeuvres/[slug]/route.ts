import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { acteurCourant } from '@/lib/acces'
import { champsDimensionsModifiees, champsPrix } from '@/lib/catalogue/conversions'

async function requireAdmin() {
  return (await acteurCourant()).type === 'admin'
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { slug } = await params
  const body     = await req.json()

  const data: Record<string, unknown> = {}
  if (typeof body.available    === 'boolean') data.available    = body.available
  if (typeof body.featured     === 'boolean') data.featured     = body.featured
  if (typeof body.title        === 'string')  data.title        = body.title.trim()
  if (typeof body.year         === 'number')  data.year         = body.year
  if (typeof body.technique    === 'string')  data.medium       = body.technique.trim()
  // Double écriture (AD-20) : anciennes et nouvelles colonnes, cohérentes ; refus si illisible.
  if (typeof body.dimensions === 'string') {
    const actuelle = await prisma.artwork.findUnique({ where: { slug }, select: { dimensions: true } })
    if (!actuelle) return NextResponse.json({ error: 'Œuvre introuvable' }, { status: 404 })
    const taille = champsDimensionsModifiees(body.dimensions, actuelle.dimensions)
    if (!taille.ok) return NextResponse.json({ error: taille.erreur }, { status: 400 })
    Object.assign(data, taille.champs)
  }
  if (body.price !== undefined) {
    const prix = champsPrix(body.price)
    if (!prix.ok) return NextResponse.json({ error: prix.erreur }, { status: 400 })
    Object.assign(data, prix.champs)
  }
  if (typeof body.description  === 'string')  data.description  = body.description.trim()

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })

  const artwork = await prisma.artwork.update({ where: { slug }, data })
  return NextResponse.json({ slug: artwork.slug, available: artwork.available })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { slug } = await params
  await prisma.artwork.delete({ where: { slug } })
  return NextResponse.json({ deleted: true })
}
