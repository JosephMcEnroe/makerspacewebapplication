import Stripe from "stripe";
import { parse } from "cookie";
import { query } from "@/lib/db";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const membershipRepo = new membershipRepositry();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const cookies = parse(req.headers.cookie || "");
    const sessionId = cookies.session_id;

    if (!sessionId) {
      return res.status(401).json({ error: "Please log in." });
    }

    const { rows } = await query(
      `SELECT u.user_id
       FROM sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.session_id = $1
         AND s.expires_at > NOW()`,
      [sessionId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    const membership = await membershipRepo.findUserMembership(user.user_id);
    if (!membership) {
      return res.status(404).json({ error: "No active membership found." });
    }

    const { enableAutoRenew } = req.body || {};
    const shouldEnable = Boolean(enableAutoRenew);

    // If a Stripe subscription is attached, update cancel_at_period_end in Stripe
    if (membership.stripe_subscription_id) {
      await stripe.subscriptions.update(membership.stripe_subscription_id, {
        cancel_at_period_end: !shouldEnable,
      });
    }

    // Update auto_renew in PostgreSQL
    await membershipRepo.updateAutoRenew(user.user_id, shouldEnable);

    return res.status(200).json({
      ok: true,
      autoRenew: shouldEnable,
      message: shouldEnable
        ? "Auto-renewal has been enabled."
        : "Auto-renewal has been disabled. Your membership will stay active until the end of your billing cycle.",
    });
  } catch (err) {
    console.error("Toggle auto-renew error:", err);
    return res.status(500).json({ error: err.message || "Failed to update auto-renewal" });
  }
}

