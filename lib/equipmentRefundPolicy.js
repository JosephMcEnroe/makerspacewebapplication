import { businessDateTime, businessTime } from "./businessTime";

export function cents(value) {
  const match = String(value ?? "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Invalid USD amount");
  const result = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Invalid USD amount");
  return result;
}

export function dollars(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid cents");
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

export function allocateCents(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total) || total < 0 || !sum || weights.some(w => !Number.isInteger(w) || w <= 0)) throw new Error("Invalid allocation");
  const values = weights.map(w => Math.floor(total * w / sum));
  let left = total - values.reduce((a, b) => a + b, 0);
  const order = weights.map((w, i) => ({ i, remainder: total * w % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) { if (!left) break; values[i]++; left--; }
  return values;
}

// Stored equipment ends are on the hour; the final 15 minutes are cleanup,
// not an extra billed hour. Operating hours never cross a DST transition.
export function equipmentHours(start, end) {
  const text = value => value instanceof Date ? businessDateTime(value) : String(value).replace(" ", "T");
  const first = text(start), last = text(end);
  const startLocal = Date.parse(`${first}Z`), endLocal = Date.parse(`${last}Z`);
  const count = (endLocal - startLocal) / 3600000;
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new Error("Invalid equipment booking duration");
  return Array.from({ length: count }, (_, i) => {
    const local = new Date(startLocal + i * 3600000).toISOString().slice(0, 19);
    const end = new Date(startLocal + (i + 1) * 3600000 - (i === count - 1 ? 15 * 60000 : 0)).toISOString().slice(0, 19);
    return { start: local, end, startMs: businessTime(local) };
  });
}

export function calculateCancellation(booking, now = Date.now()) {
  const hours = equipmentHours(booking.start_date_time, booking.end_date_time);
  const total = booking.paid_amount == null ? 0 : cents(booking.paid_amount);
  const allocations = allocateCents(total, hours.map(() => 1));
  const verified = booking.refund_eligible === true && booking.paid_amount != null
    && !!booking.payment_id && !!booking.stripe_payment_intent_id;
  let refund = 0, forfeited = 0;
  const affectedHours = hours.flatMap((hour, i) => {
    if (hour.startMs <= now) return [];
    const eligible = verified && now <= hour.startMs - 24 * 3600000;
    if (eligible) refund += allocations[i]; else forfeited += allocations[i];
    return [{ start: hour.start, end: hour.end, amount: dollars(allocations[i]), refundable: eligible }];
  });
  const reason = !verified
    ? "This reservation is non-refundable because it was edited or has no verified refundable payment."
    : "Only remaining hours starting at least 24 hours from confirmation qualify for a refund.";
  return { refundAmount: dollars(refund), forfeitedAmount: dollars(forfeited), hours: affectedHours, reason };
}
