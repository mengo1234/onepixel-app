import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import type { Database } from "./database.js";

export const eventTiers = {
  small: { participantLimit: 500, amountCents: 300, label: { it: "Evento piccolo", en: "Small event" } },
  medium: { participantLimit: 5000, amountCents: 700, label: { it: "Evento medio", en: "Medium event" } },
  large: { participantLimit: 1_000_000, amountCents: 1900, label: { it: "Evento grande", en: "Large event" } },
} as const;

export type EventTier = keyof typeof eventTiers;

export async function createEventCheckout(options: {
  database: Database;
  organizationId: string;
  tier: EventTier;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paymentId: string; checkoutUrl: string; providerSessionId: string; mock: boolean }> {
  const tier = eventTiers[options.tier];
  const paymentId = `pay_${randomUUID()}`;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const mock = process.env.ONEPIXEL_PAYMENT_MODE === "mock" || (!stripeKey && process.env.NODE_ENV !== "production");
  if (mock) {
    const providerSessionId = `mock_${randomUUID()}`;
    await options.database.query(
      "INSERT INTO event_payments (id, organization_id, tier, participant_limit, amount_cents, provider, provider_session_id, status, paid_at) VALUES ($1, $2, $3, $4, $5, 'mock', $6, 'paid', now())",
      [paymentId, options.organizationId, options.tier, tier.participantLimit, tier.amountCents, providerSessionId],
    );
    return { paymentId, checkoutUrl: `${options.successUrl}${options.successUrl.includes("?") ? "&" : "?"}payment_id=${encodeURIComponent(paymentId)}&mock=1`, providerSessionId, mock: true };
  }
  if (!stripeKey) throw new Error("STRIPE_NOT_CONFIGURED");
  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${options.successUrl}${options.successUrl.includes("?") ? "&" : "?"}payment_id=${encodeURIComponent(paymentId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl,
    client_reference_id: paymentId,
    customer_creation: "always",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: tier.amountCents,
        product_data: { name: tier.label.it, description: `onePixel · fino a ${tier.participantLimit.toLocaleString("it-IT")} partecipanti` },
      },
    }],
    metadata: { paymentId, organizationId: options.organizationId, tier: options.tier },
  });
  if (!session.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
  await options.database.query(
    "INSERT INTO event_payments (id, organization_id, tier, participant_limit, amount_cents, provider, provider_session_id, status) VALUES ($1, $2, $3, $4, $5, 'stripe', $6, 'pending')",
    [paymentId, options.organizationId, options.tier, tier.participantLimit, tier.amountCents, session.id],
  );
  return { paymentId, checkoutUrl: session.url, providerSessionId: session.id, mock: false };
}

export async function applyStripeWebhook(database: Database, rawBody: string, signature: string): Promise<string> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) throw new Error("STRIPE_NOT_CONFIGURED");
  const stripe = new Stripe(stripeKey);
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      await database.query("UPDATE event_payments SET status = 'paid', paid_at = COALESCE(paid_at, now()), metadata = metadata || $2::jsonb WHERE provider_session_id = $1 AND status = 'pending'", [session.id, JSON.stringify({ stripeEventId: event.id })]);
    }
  }
  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data.object;
    await database.query("UPDATE event_payments SET status = 'failed', metadata = metadata || $2::jsonb WHERE provider_session_id = $1 AND status = 'pending'", [session.id, JSON.stringify({ stripeEventId: event.id })]);
  }
  return event.id;
}

export async function confirmEventCheckout(options: { database: Database; organizationId: string; paymentId: string; providerSessionId: string }): Promise<{ status: string; confirmed: boolean }> {
  const payment = await options.database.query<{ status: string; provider: string; provider_session_id: string }>(
    "SELECT status, provider, provider_session_id FROM event_payments WHERE id = $1 AND organization_id = $2",
    [options.paymentId, options.organizationId],
  );
  const row = payment.rows[0];
  if (!row || row.provider_session_id !== options.providerSessionId) return { status: "not_found", confirmed: false };
  if (row.status === "paid" || row.status === "consumed") return { status: row.status, confirmed: true };
  if (row.provider !== "stripe") return { status: row.status, confirmed: false };
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("STRIPE_NOT_CONFIGURED");
  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.retrieve(options.providerSessionId);
  if (session.client_reference_id !== options.paymentId || session.metadata?.organizationId !== options.organizationId) return { status: row.status, confirmed: false };
  if (session.payment_status !== "paid") return { status: row.status, confirmed: false };
  await options.database.query("UPDATE event_payments SET status = 'paid', paid_at = COALESCE(paid_at, now()), metadata = metadata || $2::jsonb WHERE id = $1 AND status = 'pending'", [options.paymentId, JSON.stringify({ reconciledSessionId: session.id })]);
  return { status: "paid", confirmed: true };
}
