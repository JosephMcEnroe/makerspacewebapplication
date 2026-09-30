import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { priceId } = req.body;

  if (!priceId || typeof priceId !== "string") {
    return res.status(400).json({ error: "Missing or invalid priceId parameter" });
  }

  try {
    const origin =
      req.headers.origin ||
      (req.headers.host ? `http://${req.headers.host}` : "http://localhost:3000");

    // Retrieve price details to determine whether checkout mode is 'payment' or 'subscription'
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === "recurring" ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode,
      success_url: `${origin}/debugging/product-demo/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/debugging/product-demo?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Product checkout session error:", err);
    return res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
}
