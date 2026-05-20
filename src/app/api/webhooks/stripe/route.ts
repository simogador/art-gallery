import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'

// Raw body required for Stripe signature verification — do NOT parse as JSON
export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature invalide'
    console.error('[webhook] Vérification Stripe échouée :', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const artworkIds = session.metadata?.artworkIds
  if (!artworkIds) {
    console.warn('[webhook] checkout.session.completed sans artworkIds dans metadata')
    return
  }

  const slugs = artworkIds.split(',').filter(Boolean)

  const { count } = await prisma.artwork.updateMany({
    where: { slug: { in: slugs } },
    data:  { available: false },
  })

  console.log(`[webhook] ${count} œuvre(s) marquée(s) vendue(s) :`, slugs)
}
