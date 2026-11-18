import { requireStaffApi } from "@/lib/staffAuth";
import { sendReservationCheckoutStatus } from "@/lib/reservationCheckoutStatus";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const session = await requireStaffApi(req, res);
  if (!session) return;
  return sendReservationCheckoutStatus(req, res, { userId: session.user.user_id, staff: true });
}
