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

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
      break
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

  // Create order record — upsert to handle duplicate events (idempotent)
  await prisma.order.upsert({
    where: { stripeSessionId: session.id },
    update: {},
    create: {
      stripeSessionId:       session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      userId:        session.metadata?.userId ?? null,
      artworkIds:    artworkIds,
      amount:        (session.amount_total ?? 0) / 100,
      currency:      session.currency ?? 'eur',
      status:        'paid',
      customerEmail: session.customer_details?.email ?? null,
    },
  })

  console.log(`[webhook] Commande créée pour la session ${session.id}`)
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // The checkout session is the primary source of truth for orders.
  // payment_intent.succeeded fires after checkout.session.completed, so we
  // just update the order with the confirmed payment intent ID if needed.
  const piId = paymentIntent.id

  const existing = await prisma.order.findUnique({
    where: { stripePaymentIntentId: piId },
  })

  if (existing) {
    console.log(`[webhook] payment_intent.succeeded — commande ${existing.id} déjà enregistrée`)
    return
  }

  // Fallback: create order from payment intent metadata if checkout.session.completed was missed
  const artworkIds = paymentIntent.metadata?.artworkIds
  if (!artworkIds) {
    console.warn('[webhook] payment_intent.succeeded sans artworkIds dans metadata — ignoré')
    return
  }

  const slugs = artworkIds.split(',').filter(Boolean)

  await prisma.artwork.updateMany({
    where: { slug: { in: slugs } },
    data:  { available: false },
  })

  await prisma.order.create({
    data: {
      stripeSessionId:       `pi_fallback_${piId}`,
      stripePaymentIntentId: piId,
      userId:                paymentIntent.metadata?.userId ?? null,
      artworkIds,
      amount:                paymentIntent.amount_received / 100,
      currency:              paymentIntent.currency,
      status:                'paid',
      customerEmail:         paymentIntent.receipt_email ?? null,
    },
  })

  console.log(`[webhook] Commande de secours créée depuis payment_intent ${piId}`)
}
