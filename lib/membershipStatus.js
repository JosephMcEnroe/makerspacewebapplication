import { businessDateTime } from "./businessTime";

// A day pass is an ACTIVE membership with no Stripe subscription and auto-renew off.
export function isDayPass(membership) {
  return String(membership?.status ?? "").trim().toUpperCase() === "ACTIVE"
    && !membership.stripe_subscription_id
    && membership.auto_renew === false;
}

function businessDate(value) {
  return value instanceof Date ? businessDateTime(value).slice(0, 10) : String(value).slice(0, 10);
}

// Day passes are good through period_end_date and expire at midnight Eastern that night.
export function isDayPassExpired(membership, now = new Date()) {
  return isDayPass(membership) && membership.period_end_date != null
    && businessDate(membership.period_end_date) < businessDateTime(now).slice(0, 10);
}

// The stored status, except an expired day pass reads as INACTIVE. Use this instead of membership.status.
export function effectiveMembershipStatus(membership, now = new Date()) {
  if (!membership?.status) return null;
  return isDayPassExpired(membership, now) ? "INACTIVE" : String(membership.status).trim().toUpperCase();
}
