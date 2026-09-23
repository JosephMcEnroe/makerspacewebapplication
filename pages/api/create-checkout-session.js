import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const origin =
      req.headers.origin ||
      (req.headers.host ? `http://${req.headers.host}` : "http://localhost:3000");

    const session = await stripe.checkout.sessions.create({
      ui_mode: "form",
      mode: "subscription",
      // hardcoded for now, will need to setup cart system or equivalent for products
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Makerspace Membership",
            },
            recurring: {
                interval: 'month',
                },
            unit_amount: 9500, // $95.00 in cents
          },
          quantity: 1,
        },
      ],
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: err.message });
  }
}