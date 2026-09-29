import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const { session_id } = req.query;

  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "Missing or invalid session_id parameter" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    return res.status(200).json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email || null,
    });
  } catch (err) {
    console.error("Error retrieving session status:", err);
    return res.status(500).json({ error: err.message });
  }
}

