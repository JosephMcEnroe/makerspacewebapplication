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

    // Retrieve price details to determine whether checkout mode is 'payment' or 'subscription'
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === "recurring" ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/stripe/product-demo/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stripe/product-demo?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Product checkout session error:", err);
    return res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
}
