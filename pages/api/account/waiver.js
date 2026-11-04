import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

// Member signs their own waiver from the account page
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to complete the waiver." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { agreed, signature } = req.body || {};
  if (agreed !== true || typeof signature !== "string" || !signature.trim()) {
    return res.status(400).json({ error: "Agree to the waiver and type your full name to sign." });
  }

  try {
    await new UserRepository().markWaiverSigned(user.user_id);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Waiver signing error:", error);
    return res.status(500).json({ error: "Could not save your waiver. Please try again." });
  }
}
