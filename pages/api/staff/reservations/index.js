import { verifyCsrfToken } from "@/lib/csrf";
import { requireStaffApi } from "@/lib/staffAuth";
import { enrollUserInClass } from "@/lib/reservationService";
import { createReservationCheckout } from "@/lib/reservationBookingCheckout";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";

// Staff books a room, equipment, or class on behalf of a member
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireStaffApi(req, res);
  if (!session) return;
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { userId, type, resourceId, periods } = req.body || {};
  const memberId = Number(userId);
  const member = Number.isSafeInteger(memberId) && memberId > 0
    ? await new UserRepository().findById(memberId) : null;
  if (!member) {
    return res.status(400).json({ error: "Select a valid member." });
  }

  if (type === "classes") {
    const { status, body } = await enrollUserInClass({ userId: memberId, classId: Number(resourceId) });
    return res.status(status).json(body);
  }

  const membership = await new membershipRepositry().findUserMembership(memberId);
  const { status, body } = await createReservationCheckout({
    user: { ...member, role_of_membership: membership?.role_of_membership },
    actorId: session.user.user_id,
    type, resourceId, periods,
  });
  return res.status(status).json(body);
}
