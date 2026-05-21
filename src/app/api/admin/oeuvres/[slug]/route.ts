import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') return null
  return session
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
  if (typeof body.dimensions   === 'string')  data.dimensions   = body.dimensions.trim()
  if (body.price !== undefined)               data.price        = body.price ? parseFloat(body.price) : null
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
