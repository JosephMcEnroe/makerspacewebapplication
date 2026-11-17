import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "./db";
import { getStripe } from "./stripeCatalog";
import { calculateCancellation, cents } from "./equipmentRefundPolicy";

const bookingSql = `SELECT b.*, p.payment_id, p.stripe_payment_intent_id
  FROM machine_booking b LEFT JOIN payment p
    ON p.stripe_checkout_session_id = b.stripe_checkout_session_id
  WHERE b.booking_id = $1 AND b.user_id = $2`;

function signature(payload) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook secret is required for cancellation previews");
  return createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`equipment-cancel:${payload}`).digest("base64url");
}

function quoteFor(booking, actorId, now) {
  const preview = calculateCancellation(booking, now);
  const data = { bookingId: booking.booking_id, owner: booking.user_id, actorId,
    start: booking.start_date_time, end: booking.end_date_time, eligible: booking.refund_eligible,
    paid: booking.paid_amount, payment: booking.payment_id,
    ...preview, expires: now + 15 * 60000 };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return { ...preview, quote: `${payload}.${signature(payload)}` };
}

function matchesQuote(token, booking, actorId, now) {
  try {
    const [payload, mac, extra] = String(token).split(".");
    if (extra || !mac || payload.length > 20000) return false;
    const expected = Buffer.from(signature(payload)), supplied = Buffer.from(mac);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    const old = JSON.parse(Buffer.from(payload, "base64url").toString());
    const fresh = JSON.parse(Buffer.from(quoteFor(booking, actorId, now).quote.split(".")[0], "base64url").toString());
    const expiry = old.expires;
    delete old.expires; delete fresh.expires;
    return expiry >= now && JSON.stringify(old) === JSON.stringify(fresh);
  } catch { return false; }
}

export async function equipmentCancellation({ userId, actorId, reservationId, preview, quote }) {
  if (!Number.isSafeInteger(Number(reservationId)) || Number(reservationId) < 1) return { status: 400, body: { error: "Invalid reservation." } };
  const client = await getPool().connect();
  let refundId;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`${bookingSql} FOR UPDATE OF b`, [Number(reservationId), userId]);
    const booking = rows[0];
    if (!booking) { await client.query("ROLLBACK"); return { status: 404, body: { error: "Reservation not found." } }; }
    if (!booking.booking_active) {
      const existing = await client.query("SELECT * FROM equipment_refund WHERE booking_id = $1", [booking.booking_id]);
      await client.query("COMMIT");
      return { status: 200, body: { ok: true, cancelled: true, refund: existing.rows[0] || null } };
    }
    const now = Date.now();
    const fresh = quoteFor(booking, actorId, now);
    if (preview) { await client.query("ROLLBACK"); return { status: 200, body: { preview: fresh } }; }
    if (!matchesQuote(quote, booking, actorId, now)) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "Review the updated cancellation amounts and confirm again.", preview: fresh } };
    }
    await client.query(`UPDATE machine_booking SET booking_active = false, cancelled_at = $3, cancelled_by = $4
      WHERE booking_id = $1 AND user_id = $2 AND booking_active = true`, [booking.booking_id, userId, new Date(now), actorId]);
    if (booking.payment_id) {
      const inserted = await client.query(`INSERT INTO equipment_refund (booking_id, payment_id, amount, status)
        VALUES ($1, $2, $3, $4) RETURNING refund_id`,
      [booking.booking_id, booking.payment_id, fresh.refundAmount, cents(fresh.refundAmount) ? "queued" : "not_required"]);
      refundId = inserted.rows[0].refund_id;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Equipment cancellation failed:", error.message);
    return { status: 500, body: { error: "Could not cancel the reservation. Please try again." } };
  } finally { client.release(); }
  // The durable queued record survives network failures and process termination.
  if (refundId) {
    try { await processEquipmentRefund(refundId); }
    catch (error) { console.error("Equipment refund awaits recovery:", refundId, error.message); }
  }
  return { status: 200, body: { ok: true, cancelled: true } };
}

function providerStatus(refund) {
  if (refund.status === "succeeded") return "succeeded";
  if (["failed", "canceled", "requires_action"].includes(refund.status)) return "failed";
  return "pending";
}

export async function processEquipmentRefund(refundId) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT payment_id FROM equipment_refund WHERE refund_id = $1", [refundId]);
    if (!result.rows[0]) { await client.query("COMMIT"); return; }
    // Serialize refunds sharing a payment, including webhook/recovery requests.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`equipment-refund-payment:${result.rows[0].payment_id}`]);
    const { rows } = await client.query(`SELECT r.*, p.stripe_payment_intent_id, p.amount AS payment_amount
      FROM equipment_refund r JOIN payment p ON p.payment_id = r.payment_id
      WHERE r.refund_id = $1 FOR UPDATE OF r`, [refundId]);
    const request = rows[0];
    if (!request || request.status === "not_required" || (request.status === "failed" && !request.stripe_refund_id)) { await client.query("COMMIT"); return; }
    if (!request.stripe_payment_intent_id || cents(request.amount) === 0) {
      await client.query("UPDATE equipment_refund SET status = 'failed' WHERE refund_id = $1", [refundId]);
      await client.query("COMMIT");
      console.warn("Refund needs review: missing payment reference or invalid amount", refundId);
      return;
    }
    const stripe = getStripe({ timeout: 8000, maxNetworkRetries: 0 });
    let refund;
    if (request.stripe_refund_id) {
      refund = await stripe.refunds.retrieve(request.stripe_refund_id);
    } else {
      const all = [];
      for await (const item of stripe.refunds.list({ payment_intent: request.stripe_payment_intent_id, limit: 100 })) all.push(item);
      const matches = all.filter(item => item.metadata?.equipment_refund_id === String(refundId));
      if (matches.length > 1) throw new Error("Multiple Stripe refunds found for one operation; manual review required");
      refund = matches[0];
      if (!refund) {
        const known = await client.query("SELECT stripe_refund_id FROM equipment_refund WHERE payment_id = $1 AND stripe_refund_id IS NOT NULL", [request.payment_id]);
        const knownIds = new Set(known.rows.map(row => row.stripe_refund_id));
        // A Dashboard refund has no per-booking allocation. Never guess which
        // other reservation's funds remain refundable.
        const external = all.some(item => !["failed", "canceled"].includes(item.status) && !knownIds.has(item.id));
        const consumed = all.filter(item => !["failed", "canceled"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
        if (external || !request.stripe_payment_intent_id || consumed + cents(request.amount) > cents(request.payment_amount)) {
          await client.query("UPDATE equipment_refund SET status = 'failed' WHERE refund_id = $1", [refundId]);
          await client.query("COMMIT");
          console.warn("Refund needs review: external refund or insufficient remaining payment", refundId);
          return;
        }
        refund = await stripe.refunds.create({ payment_intent: request.stripe_payment_intent_id,
          amount: cents(request.amount), reason: "requested_by_customer",
          metadata: { equipment_refund_id: String(refundId), booking_id: String(request.booking_id) } },
        { idempotencyKey: `equipment-refund-${refundId}` });
      }
    }
    if (refund.currency !== "usd" || refund.amount !== cents(request.amount)
      || (typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id) !== request.stripe_payment_intent_id) {
      throw new Error("Refund does not match the approved payment and amount");
    }
    await client.query("UPDATE equipment_refund SET stripe_refund_id = $2, status = $3 WHERE refund_id = $1",
      [refundId, refund.id, providerStatus(refund)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function handleEquipmentRefundEvent(refund) {
  const { rows } = await getPool().query(`SELECT refund_id FROM equipment_refund
    WHERE stripe_refund_id = $1 OR refund_id::text = $2`, [refund.id, refund.metadata?.equipment_refund_id || ""]);
  for (const row of rows) await processEquipmentRefund(row.refund_id);
}

export async function recoverEquipmentRefunds() {
  const { rows } = await getPool().query(`SELECT refund_id FROM equipment_refund
    WHERE status IN ('queued', 'pending')
    ORDER BY CASE WHEN status = 'queued' THEN 0 ELSE 1 END, random() LIMIT 10`);
  const results = [];
  const deadline = Date.now() + 45000;
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    try { await processEquipmentRefund(row.refund_id); results.push({ id: row.refund_id, checked: true }); }
    catch (error) { console.error("Refund recovery failed:", row.refund_id, error.message); results.push({ id: row.refund_id, checked: false }); }
  }
  return results;
}
