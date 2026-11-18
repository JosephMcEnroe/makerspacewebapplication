import { getSessionUser } from "@/lib/session";
import { sendReservationCheckoutStatus } from "@/lib/reservationCheckoutStatus";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in to view your reservation." });
  return sendReservationCheckoutStatus(req, res, { userId: user.user_id });
}
