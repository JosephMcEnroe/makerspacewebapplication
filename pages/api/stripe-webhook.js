import Stripe from "stripe";
import { fulfillReservation } from "@/lib/reservationCheckout";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { paymentRepository } from "@/Data_Access_Layer/paymentRepository";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const membershipRepo = new membershipRepositry();
const paymentRepo = new paymentRepository();

// Stripe signs the raw request body, so Next's JSON body parser must be off for this route.
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Unix seconds (or a Date) -> 'YYYY-MM-DD' for the DATE columns on the membership table
function toDateString(value) {
  const date = typeof value === "number" ? new Date(value * 1000) : value;
  return date.toISOString().slice(0, 10);
}

// Newer Stripe API versions moved the billing period onto the subscription items
function getSubscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0];
  const start = item?.current_period_start ?? subscription.current_period_start;
  const end = item?.current_period_end ?? subscription.current_period_end;
  return { start: toDateString(start), end: toDateString(end) };
}

// Newer Stripe API versions moved invoice.subscription under invoice.parent
function getInvoiceSubscriptionId(invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id;
}

// Returns 'monthly', 'day_pass', or null if the checkout wasn't for a membership product
async function getMembershipType(session) {
  // 1. Direct metadata from create-product-checkout.js
  if (session.metadata?.membership_type) {
    return session.metadata.membership_type;
  }

  // 2. Subscription mode is inherently a monthly recurring membership
  if (session.mode === "subscription") {
    return "monthly";
  }

  // 3. Fallback: inspect line items product metadata and name
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
    });
    for (const item of lineItems.data) {
      const prodType = item.price?.product?.metadata?.membership_type;
      const priceType = item.price?.metadata?.membership_type;
      const type = prodType || priceType;
      if (type === "monthly" || type === "day_pass") return type;

      // 4. Name-based fallback so day passes are never silently dropped
      const productName = (item.price?.product?.name || "").toLowerCase();
      if (productName.includes("day pass")) return "day_pass";
      if (productName.includes("membership")) return "monthly";
    }
  } catch (err) {
    console.warn("[Webhook] Could not inspect line items for membership type:", err.message);
  }

  return null;
}

async function handleCheckoutCompleted(session) {
  if (session.metadata?.purchase_type === "reservation") {
    await fulfillReservation(session);
    return;
  }
  console.log(`[Webhook] Processing checkout.session.completed for session: ${session.id}`);

  // Delayed payment methods complete checkout before the money arrives;
  // those are handled by checkout.session.async_payment_succeeded instead.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.log(`[Webhook] Checkout ${session.id} not paid yet (${session.payment_status}), skipping`);
    return;
  }

  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) {
    console.warn(`[Webhook] Checkout ${session.id} has no user_id, cannot activate membership`);
    return;
  }

  const membershipType = await getMembershipType(session);
  if (!membershipType) {
    console.log(`[Webhook] Checkout ${session.id} was not a membership purchase, skipping`);
    return;
  }

  let period;
  let subscriptionId = null;
  if (membershipType === "monthly" && session.subscription) {
    subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    period = getSubscriptionPeriod(subscription);
  } else {
    // Day pass is good for the day it was bought
    const today = toDateString(new Date());
    period = { start: today, end: today };
  }

  const numericUserId = parseInt(userId, 10);
  const autoRenew = membershipType === "monthly";

  try {
    const activated = await membershipRepo.activateMembership(numericUserId, period.start, period.end, subscriptionId, autoRenew);
    console.log(`[Webhook] Activated ${membershipType} membership for user ${numericUserId} (${period.start} to ${period.end}, auto_renew=${autoRenew})`);

    // Record initial payment in the payment ledger
    if (session.amount_total) {
      try {
        const invoiceId =
          (typeof session.invoice === "string" ? session.invoice : session.invoice?.id) ||
          (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) ||
          session.id;
        await paymentRepo.createPayment({
          user_id: numericUserId,
          membership_id: activated?.membership_id || null,
          amount: session.amount_total / 100,
          payment_date: new Date(),
          payment_method: "stripe",
          stripe_invoice_id: invoiceId || null,
        });
        console.log(`[Webhook] Recorded payment of $${session.amount_total / 100} for user ${numericUserId} (Invoice: ${invoiceId || "N/A"})`);
      } catch (payErr) {
        console.error("[Webhook] Failed to record checkout payment in database:", payErr.message);
      }
    }
  } catch (dbErr) {
    console.error(`[Webhook] Database error activating membership for user ${numericUserId}:`, dbErr.message);
    throw dbErr;
  }
}

async function handleInvoicePaid(invoice) {
  console.log(`[Webhook] Processing invoice.paid for invoice: ${invoice.id}`);

  // The first invoice is already handled by checkout.session.completed
  if (invoice.billing_reason === "subscription_create") return;

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.warn(`[Webhook] Subscription ${subscriptionId} has no user_id, cannot renew membership`);
    return;
  }

  const numericUserId = parseInt(userId, 10);
  const period = getSubscriptionPeriod(subscription);

  try {
    const activated = await membershipRepo.activateMembership(numericUserId, period.start, period.end, subscriptionId);
    console.log(`[Webhook] Renewed membership for user ${numericUserId} through ${period.end}`);

    // Record recurring renewal payment in the payment ledger
    if (invoice.amount_paid) {
      try {
        await paymentRepo.createPayment({
          user_id: numericUserId,
          membership_id: activated?.membership_id || null,
          amount: invoice.amount_paid / 100,
          payment_date: new Date(),
          payment_method: "stripe",
          stripe_invoice_id: invoice.id || null,
        });
        console.log(`[Webhook] Recorded renewal payment of $${invoice.amount_paid / 100} for user ${numericUserId} (Invoice: ${invoice.id})`);
      } catch (payErr) {
        console.error("[Webhook] Failed to record renewal payment in database:", payErr.message);
      }
    }
  } catch (dbErr) {
    console.error(`[Webhook] Database error renewing membership for user ${numericUserId}:`, dbErr.message);
    throw dbErr;
  }
}

async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  const autoRenew = !subscription.cancel_at_period_end;
  await membershipRepo.updateAutoRenew(userId, autoRenew);
  console.log(`Updated auto_renew=${autoRenew} for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.warn(`Subscription ${subscription.id} has no user_id, cannot deactivate membership`);
    return;
  }

  await membershipRepo.deactivateMembership(userId);
  console.log(`Deactivated membership for user ${userId}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // Verify the request actually came from Stripe
  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // Ignore events we don't care about
        break;
    }
  } catch (err) {
    // A 500 tells Stripe to retry the event later
    console.error(`Error handling Stripe event ${event.type}:`, err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.status(200).json({ received: true });
}
