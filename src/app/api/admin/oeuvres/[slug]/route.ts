import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { acteurCourant } from '@/lib/acces'
import { champsDimensionsModifiees, champsPrix } from '@/lib/catalogue/conversions'
import { definirPublication } from '@/lib/curation'
import { definirDisponibilite } from '@/lib/disponibilite'

const REFUS = {
  acces_refuse:         { error: 'Accès refusé', status: 403 },
  introuvable:          { error: 'Œuvre introuvable', status: 404 },
  non_recopiee:         { error: 'Cette œuvre n’a pas encore été recopiée : son état ne peut pas être modifié.', status: 409 },
  transition_interdite: { error: 'Cette œuvre est réservée, vendue ailleurs ou retirée : elle ne peut pas basculer entre disponible et vendue.', status: 409 },
} as const

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { slug } = await params
  const body     = await req.json()

  const data: Record<string, unknown> = {}
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

  // Story 2.2 : publication (« Publiée / Brouillon ») par le module curation, disponibilité
  // (« Disponible / Vendue ») par le module disponibilite ; jamais écrites ici.
  const publiee    = typeof body.publiee   === 'boolean' ? body.publiee   as boolean : undefined
  const disponible = typeof body.available === 'boolean' ? body.available as boolean : undefined

  if (Object.keys(data).length === 0 && publiee === undefined && disponible === undefined)
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })

  if (Object.keys(data).length > 0) {
    const { count } = await prisma.artwork.updateMany({ where: { slug }, data })
    if (count === 0) return NextResponse.json({ error: 'Œuvre introuvable' }, { status: 404 })
  }
  if (publiee !== undefined) {
    const resultat = await definirPublication(acteur, slug, publiee)
    if (!resultat.ok) return NextResponse.json({ error: REFUS[resultat.code].error }, { status: REFUS[resultat.code].status })
  }
  if (disponible !== undefined) {
    const resultat = await definirDisponibilite(acteur, slug, disponible)
    if (!resultat.ok) return NextResponse.json({ error: REFUS[resultat.code].error }, { status: REFUS[resultat.code].status })
  }

  return NextResponse.json({ slug })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if ((await acteurCourant()).type !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { slug } = await params
  await prisma.artwork.delete({ where: { slug } })
  return NextResponse.json({ deleted: true })
}
