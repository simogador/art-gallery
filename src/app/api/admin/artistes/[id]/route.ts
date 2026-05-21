import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') return null
  return session
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id }  = await params
  const body    = await req.json()

  const data: Record<string, unknown> = {}
  if (typeof body.active   === 'boolean') data.active   = body.active
  if (typeof body.featured === 'boolean') data.featured = body.featured

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })

  const artist = await prisma.artist.update({ where: { id }, data })
  return NextResponse.json({ id: artist.id, active: artist.active, featured: artist.featured })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  await prisma.artist.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
