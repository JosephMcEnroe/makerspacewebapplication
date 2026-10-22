import Stripe from "stripe";
import { parse } from "cookie";
import { query } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { priceId } = req.body || {};

  if (!priceId || typeof priceId !== "string") {
    return res.status(400).json({ error: "Missing or invalid priceId parameter" });
  }

  try {
    const cookies = parse(req.headers.cookie || "");
    const sessionId = cookies.session_id;

    if (!sessionId) {
      return res.status(401).json({ error: "Please log in before checking out." });
    }

    // Look up the account directly so users without a membership can checkout.
    const { rows } = await query(
      `SELECT u.user_id, u.email
       FROM sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.session_id = $1
         AND s.expires_at > NOW()`,
      [sessionId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Your session has expired. Please log in again.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        error: "Please add an email address to your account before checking out.",
      });
    }

    const origin =
      req.headers.origin ||
      (req.headers.host ? `http://${req.headers.host}` : "http://localhost:3000");

    // Retrieve price details (with product expanded) to determine checkout mode and membership type
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const mode = price.type === "recurring" ? "subscription" : "payment";
    const product = typeof price.product === "object" ? price.product : null;

    // Classify membership type from product metadata or name
    let membershipType = null;
    if (price.type === "recurring") {
      membershipType = "monthly";
    } else if (
      product?.metadata?.membership_type === "day_pass" ||
      product?.name?.toLowerCase().includes("day pass")
    ) {
      membershipType = "day_pass";
    }

    // user_id is attached so the Stripe webhook knows whose membership to activate.
    // For subscriptions it is also copied onto the subscription so renewals/cancellations can be matched.
    const userId = String(user.user_id);
    const sessionMetadata = {
      user_id: userId,
      ...(membershipType && { membership_type: membershipType }),
    };

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      client_reference_id: userId,
      metadata: sessionMetadata,
      ...(mode === "subscription" && { subscription_data: { metadata: sessionMetadata } }),
      // Enable invoice generation for one-time payments so day passes receive a real Stripe invoice ID
      ...(mode === "payment" && { invoice_creation: { enabled: true } }),
      success_url: `${origin}/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stripe/checkout?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Product checkout session error:", err);
    return res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
}
