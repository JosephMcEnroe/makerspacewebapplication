import Stripe from "stripe";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const membershipRepo = new membershipRepositry();

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
async function getMembershipType(sessionId) {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price.product"],
  });
  for (const item of lineItems.data) {
    const type = item.price?.product?.metadata?.membership_type;
    if (type === "monthly" || type === "day_pass") return type;
  }
  return null;
}

async function handleCheckoutCompleted(session) {
  // Delayed payment methods complete checkout before the money arrives;
  // those are handled by checkout.session.async_payment_succeeded instead.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.log(`Checkout ${session.id} not paid yet (${session.payment_status}), skipping`);
    return;
  }

  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) {
    console.warn(`Checkout ${session.id} has no user_id, cannot activate membership`);
    return;
  }

  const membershipType = await getMembershipType(session.id);
  if (!membershipType) {
    console.log(`Checkout ${session.id} was not a membership purchase, skipping`);
    return;
  }

  let period;
  if (membershipType === "monthly" && session.subscription) {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    period = getSubscriptionPeriod(subscription);
  } else {
    // Day pass is good for the day it was bought
    const today = toDateString(new Date());
    period = { start: today, end: today };
  }

  await membershipRepo.activateMembership(userId, period.start, period.end);
  console.log(`Activated ${membershipType} membership for user ${userId} (${period.start} to ${period.end})`);
}

async function handleInvoicePaid(invoice) {
  // The first invoice is already handled by checkout.session.completed
  if (invoice.billing_reason === "subscription_create") return;

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.warn(`Subscription ${subscriptionId} has no user_id, cannot renew membership`);
    return;
  }

  const period = getSubscriptionPeriod(subscription);
  await membershipRepo.activateMembership(userId, period.start, period.end);
  console.log(`Renewed membership for user ${userId} through ${period.end}`);
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
