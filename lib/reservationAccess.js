import { effectiveMembershipStatus } from "./membershipStatus";

export const MEMBERSHIP_REQUIRED_MESSAGE = "An active membership is required to make reservations.";

// Active members (including an unexpired day pass), staff and admins can reserve rooms, equipment and classes.
// Accepts the server session row (role_of_membership) or the client auth user (role).
export function canReserve(user) {
  if (!user) return false;
  const status = effectiveMembershipStatus(user);
  const role = String(user.role_of_membership ?? user.role ?? "").trim().toUpperCase();
  return status === "ACTIVE" || role === "STAFF" || role === "ADMIN";
}
