import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type { CartItem } from '@/lib/store/cart'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { items }: { items: CartItem[] } = await req.json()

  if (!items?.length) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
  }

  const slugs = items.map((i) => i.id)

  // Validate prices server-side against DB — never trust the client
  const dbArtworks = await prisma.artwork.findMany({
    where:   { slug: { in: slugs } },
    include: { artist: { select: { name: true } } },
  })

  const lineItems = []
  const validatedIds: string[] = []

  for (const slug of slugs) {
    const artwork = dbArtworks.find((a) => a.slug === slug)

    if (!artwork) {
      return NextResponse.json({ error: `Œuvre introuvable : ${slug}` }, { status: 400 })
    }
    if (!artwork.available) {
      return NextResponse.json({ error: `"${artwork.title}" n'est plus disponible.` }, { status: 400 })
    }
    if (!artwork.price) {
      return NextResponse.json({ error: `"${artwork.title}" n'a pas de prix défini.` }, { status: 400 })
    }

    lineItems.push({
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(artwork.price * 100), // cents
        product_data: {
          name: artwork.title,
          description: `${artwork.artist.name} · ${artwork.year} · ${artwork.medium}`,
        },
      },
      quantity: 1,
    })
    validatedIds.push(artwork.slug)
  }

  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000'

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    customer_email: session.user.email ?? undefined,
    success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${baseUrl}/panier`,
    metadata: {
      userId:     session.user.id ?? '',
      artworkIds: validatedIds.join(','),
    },
    payment_intent_data: {
      metadata: {
        userId:     session.user.id ?? '',
        artworkIds: validatedIds.join(','),
      },
    },
    locale: 'fr',
  })

  return NextResponse.json({ url: checkoutSession.url })
}
