import { businessTime } from "./businessTime";

export const MEMBERSHIP_REQUIRED = {
  code: "MEMBERSHIP_REQUIRED",
  error: "An active membership or valid day pass is required to make or change reservations.",
};

function boundary(value, end) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) return NaN;
    if (end) day.setUTCDate(day.getUTCDate() + 1);
    return businessTime(`${day.toISOString().slice(0, 10)}T00:00:00`);
  }
  // PostgreSQL timestamptz text may use a short offset such as -05.
  const normalized = typeof value === "string" && /[T ]\d{2}:\d{2}/.test(value) && /[+-]\d{2}$/.test(value)
    ? `${value}:00` : value;
  return businessTime(normalized);
}

export function hasActiveMembership(membership, now = Date.now()) {
  if (String(membership?.status || "").trim().toUpperCase() !== "ACTIVE") return false;
  const start = membership.period_start_date == null ? -Infinity : boundary(membership.period_start_date, false);
  const end = membership.period_end_date == null ? Infinity : boundary(membership.period_end_date, true);
  return start <= now && now < end;
}
