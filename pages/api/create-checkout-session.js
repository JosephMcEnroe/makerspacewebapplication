import Stripe from "stripe";
import { getSessionUser } from "@/lib/session";
import { resolveDiscount } from "@/lib/discounts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Sign in before checking out." });
    const discount = await resolveDiscount({ user, subscription: true, stripe });
    const origin =
      req.headers.origin ||
      (req.headers.host ? `http://${req.headers.host}` : "http://localhost:3000");

    const session = await stripe.checkout.sessions.create({
      ...(discount && { discounts: [{ coupon: discount.couponId }] }),
      client_reference_id: String(user.user_id),
      metadata: { user_id: String(user.user_id), membership_type: "monthly" },
      subscription_data: { metadata: { user_id: String(user.user_id), membership_type: "monthly" } },
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
    res.status(err.status || 500).json({ error: err.message });
  }
}
