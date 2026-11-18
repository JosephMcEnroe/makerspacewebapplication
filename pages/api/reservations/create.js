import { hasActiveMembership, MEMBERSHIP_REQUIRED } from "@/lib/membershipEligibility";
import { getSessionUser, WAIVER_REQUIRED } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { createReservationCheckout } from "@/lib/reservationBookingCheckout";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to make a reservation." });
  if (!hasActiveMembership(user)) return res.status(403).json(MEMBERSHIP_REQUIRED);
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });
  if (user.waiver_status !== true) return res.status(403).json(WAIVER_REQUIRED);

  const { type, resourceId, periods } = req.body || {};
  const { status, body } = await createReservationCheckout({
    user, type, resourceId, periods,
    requestOrigin: req.headers.origin || `http://${req.headers.host}`,
  });
  return res.status(status).json(body);
}
