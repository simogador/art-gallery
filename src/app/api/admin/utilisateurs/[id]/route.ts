import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const VALID_ROLES = ['user', 'artist', 'admin'] as const

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body   = await req.json()

  if (!body.role || !VALID_ROLES.includes(body.role))
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

  const user = await prisma.user.update({
    where: { id },
    data:  { role: body.role },
    select: { id: true, email: true, role: true },
  })

  return NextResponse.json(user)
}
