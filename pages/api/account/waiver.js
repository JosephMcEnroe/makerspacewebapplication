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

  const normalizeName = (value) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

  if (
    typeof user.first_name !== "string" ||
    typeof user.last_name !== "string" ||
    !user.first_name.trim() ||
    !user.last_name.trim()
  ) {
    return res.status(400).json({
      error: "Your account must have a first and last name before signing.",
    });
  }

  const expectedName = normalizeName(
    `${user.first_name} ${user.last_name}`
  );

  if (normalizeName(signature) !== expectedName) {
    return res.status(400).json({
      error: "Your signature must match the first and last name on your account.",
    });
  }

  try {
    await new UserRepository().markWaiverSigned(user.user_id);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Waiver signing error:", error);
    return res.status(500).json({ error: "Could not save your waiver. Please try again." });
  }
}
