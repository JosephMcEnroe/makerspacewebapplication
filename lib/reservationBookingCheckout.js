import { businessTime } from "@/lib/businessTime";
import { resolveDiscount } from "@/lib/discounts";
import { countEquipmentReservationHours, hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";
import { mergeRoomReservationPeriods } from "@/lib/reservationGrouping";
import { getCalendarMonthSelection, isMonthlyPeriod, ROOM_BOOKING_ADVANCE_DAYS } from "@/lib/monthlyReservation";
import { isMonthlyStudioResource } from "@/lib/resourceGroups";
import { getPool, query } from "@/lib/db";
import { getStripe, loadStripeProducts, matchResourceProduct, studioCheckoutLineItem } from "@/lib/stripeCatalog";
import { bookingColumns, reservationMetadata, validateCheckoutPeriods } from "@/lib/reservationCheckout";
import { createResourceReservations } from "@/lib/reservationService";

async function checkoutEmail(user) {
  if (user.email) return user.email;
  const { rows } = await query('SELECT email FROM "users" WHERE user_id = $1', [user.user_id]);
  return rows[0]?.email;
}

async function startPaidCheckout({ user, type, resourceId, periods, requestOrigin, actorId, product, calendarMonths }) {
  const studio = type === "rooms";
  let origin;
  try {
    const fallback = studio || actorId != null
      ? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")
      : requestOrigin;
    const url = new URL(process.env.APP_URL || fallback);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid origin");
    origin = url.origin;
  } catch {
    return { status: 503, body: { error: "Reservation checkout return URL is not configured. Please contact staff." } };
  }

  const email = await checkoutEmail(user);
  const discount = await resolveDiscount({ user, type, periods, productId: product.id });
  const memberPage = studio ? "rooms" : "equipment";
  const cancelParams = new URLSearchParams({ canceled: "true", resourceId: String(resourceId) });
  if (actorId != null) {
    cancelParams.set("userId", String(user.user_id));
    cancelParams.set("type", type);
  }
  const session = await getStripe().checkout.sessions.create({
    ...(discount && { discounts: [{ coupon: discount.couponId }] }),
    ...(!studio && { customer_creation: "always" }),
    mode: "payment",
    customer_email: email,
    payment_method_types: ["card"],
    client_reference_id: String(user.user_id),
    line_items: [studio ? studioCheckoutLineItem(product, calendarMonths)
      : { price: product.priceId, quantity: countEquipmentReservationHours(periods) }],
    metadata: {
      ...reservationMetadata(type, resourceId, user.user_id, periods),
      ...(actorId != null && { staff_user_id: String(actorId) }),
    },
    invoice_creation: { enabled: true },
    success_url: `${origin}${actorId != null ? "/staff" : ""}/reservations/checkout-return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${actorId != null ? "staff/reservations/new" : memberPage}?${cancelParams}`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { status: 200, body: { url: session.url } };
}

export async function createReservationCheckout({ user, type, resourceId, periods: requestedPeriods, requestOrigin, actorId }) {
  let periods;
  let calendarMonths = null;
  try {
    if (!/^\d+$/.test(String(resourceId))) throw new Error("Invalid resource.");
    if (type === "rooms") {
      periods = requestedPeriods;
      const monthSelection = getCalendarMonthSelection(periods);
      calendarMonths = monthSelection?.count ?? null;
      if (calendarMonths === null && Array.isArray(periods) && periods.some(isMonthlyPeriod)) {
        throw new Error("Studio rentals must start on the first day of a calendar month.");
      }
      if (calendarMonths !== null) {
        periods = monthSelection.periods;
        const now = Date.now();
        if (periods.some(({ start }) => {
          const startTime = businessTime(start);
          return !Number.isFinite(startTime) || startTime <= now || startTime > now + ROOM_BOOKING_ADVANCE_DAYS * 86400000;
        })) {
          throw new Error("Choose one to twelve future calendar months starting within one year.");
        }
      } else {
        if (!Array.isArray(periods) || !periods.length || periods.length > 21
          || periods.some(period => !isValidReservationPeriod("rooms", period)) || !hasReservationBuffer(periods)) {
          throw new Error("Choose valid one-hour room slots with a 15-minute buffer.");
        }
        periods = mergeRoomReservationPeriods(periods, { userId: user.user_id, roomId: Number(resourceId) });
        const now = Date.now();
        if (periods.some(period => !Number.isFinite(businessTime(period.start)) || !Number.isFinite(businessTime(period.end))
          || businessTime(period.start) <= now || businessTime(period.start) > now + ROOM_BOOKING_ADVANCE_DAYS * 86400000)) {
          throw new Error("Choose a future room reservation within one year.");
        }
      }
    } else {
      periods = validateCheckoutPeriods(type, requestedPeriods);
    }
  } catch (error) {
    return { status: 400, body: { error: error.message } };
  }

  try {
    if (type === "rooms") {
      const { rows } = await query(
        'SELECT room_id, name, type, stripe_room_id AS stripe_key FROM "room" WHERE room_id = $1',
        [Number(resourceId)]
      );
      const room = rows[0];
      if (!room) return { status: 404, body: { error: "Room not found." } };
      const isStudio = isMonthlyStudioResource({ name: room.name, description: room.type, stripeKey: room.stripe_key });
      if (calendarMonths === null && isStudio) {
        return { status: 400, body: { error: "Choose one to twelve future calendar months for this studio." } };
      }

      if (calendarMonths !== null) {
        if (!isStudio) {
          return { status: 400, body: { error: "Only studios can be rented by calendar month." } };
        }
        if (!process.env.STRIPE_SECRET_KEY) {
          return { status: 503, body: { error: "Studio checkout is not configured. Please contact staff." } };
        }
        const client = await getPool().connect();
        let conflict;
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
          for (const period of periods) {
            conflict = await client.query(`SELECT 1 FROM "room_reservation" WHERE room_id = $1
              AND start_date < $3::timestamp AND end_date > $2::timestamp
              AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%') LIMIT 1`,
            [Number(resourceId), period.start, period.end]);
            if (conflict.rowCount) break;
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        if (conflict?.rowCount) return { status: 409, body: { error: "This studio is unavailable during part of the selected months." } };

        let product;
        try {
          product = matchResourceProduct(await loadStripeProducts(), "rooms", room.stripe_key);
        } catch (error) {
          console.error("Studio rental pricing configuration:", error);
          return { status: 503, body: { error: "This studio's monthly Stripe pricing is not configured. Please contact staff." } };
        }
        return await startPaidCheckout({ user, type, resourceId, periods, requestOrigin, actorId, product, calendarMonths });
      }

      if (actorId != null) {
        return await createResourceReservations({ userId: user.user_id, type, resourceId, periods: requestedPeriods });
      }

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
        const reservationIds = [];
        for (const period of periods) {
          const conflict = await client.query(`SELECT 1 FROM "room_reservation" WHERE room_id = $1
            AND start_date < $3::timestamp + INTERVAL '15 minutes' AND end_date > $2::timestamp - INTERVAL '15 minutes'
            AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%') LIMIT 1`,
          [Number(resourceId), period.start, period.end]);
          if (conflict.rowCount) {
            await client.query("ROLLBACK");
            return { status: 409, body: { error: "One or more selected times are no longer available." } };
          }
          const inserted = await client.query(`INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status, stripe_checkout_session_id)
            VALUES ($1, $2, $3, $4, 'upcoming', NULL) RETURNING reservation_id`,
          [user.user_id, Number(resourceId), period.start, period.end]);
          reservationIds.push(inserted.rows[0].reservation_id);
        }
        await client.query("COMMIT");
        return { status: 201, body: { ok: true, reservationIds } };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const resource = await query('SELECT stripe_machine_id AS stripe_key, status FROM "machine" WHERE machine_id = $1', [Number(resourceId)]);
    const row = resource.rows[0];
    if (!row) return { status: 404, body: { error: "Resource not found." } };
    if (row.status && row.status.toLowerCase() !== "available") return { status: 409, body: { error: "Equipment is currently unavailable." } };
    const columns = bookingColumns(type);
    for (const period of periods) {
      const conflict = await query(`SELECT 1 FROM ${columns.table} WHERE ${columns.resource} = $1
        AND ${columns.start} < $3::timestamp AND ${columns.end} > $2::timestamp ${columns.status} LIMIT 1`,
      [Number(resourceId), period.start, period.end]);
      if (conflict.rowCount) return { status: 409, body: { error: "The selected times are no longer available." } };
    }
    let product;
    try {
      product = matchResourceProduct(await loadStripeProducts(), type, row.stripe_key);
    } catch (error) {
      console.error("Reservation product configuration:", error);
      return { status: 503, body: { error: "This resource's Stripe pricing is not configured. Please contact staff." } };
    }
    if (product.default_price.currency !== "usd") return { status: 503, body: { error: "Equipment checkout requires USD pricing." } };
    return await startPaidCheckout({ user, type, resourceId, periods, requestOrigin, actorId, product });
  } catch (error) {
    console.error("Reservation checkout error:", error);
    return { status: error.status || 500, body: { error: error.status === 503 ? error.message : "Could not start reservation checkout. Please try again." } };
  }
}
