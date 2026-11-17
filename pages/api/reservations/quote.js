import { getSessionUser } from "@/lib/session";
import { query } from "@/lib/db";
import { validateCheckoutPeriods } from "@/lib/reservationCheckout";
import { getCalendarMonthSelection } from "@/lib/monthlyReservation";
import { countEquipmentReservationHours } from "@/lib/reservationPeriods";
import { isMonthlyStudioResource } from "@/lib/resourceGroups";
import { loadStripeProducts, matchResourceProduct } from "@/lib/stripeCatalog";
import { resolveDiscount, priceQuote } from "@/lib/discounts";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to see your reservation price." });
  const { type, resourceId } = req.body || {};
  let periods;
  try {
    if (!/^\d+$/.test(String(resourceId))) throw new Error("Invalid resource.");
    periods = validateCheckoutPeriods(type, req.body?.periods);
  } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const room = type === "rooms";
    const { rows } = await query(room
      ? 'SELECT name, type, stripe_room_id AS stripe_key FROM "room" WHERE room_id = $1'
      : 'SELECT stripe_machine_id AS stripe_key FROM "machine" WHERE machine_id = $1', [Number(resourceId)]);
    const resource = rows[0];
    if (!resource) return res.status(404).json({ error: "Resource not found." });
    if (room && !isMonthlyStudioResource({ name: resource.name, description: resource.type })) {
      return res.status(400).json({ error: "This room does not use paid monthly reservations." });
    }
    const product = matchResourceProduct(await loadStripeProducts(), type, resource.stripe_key);
    if (!room && product.currency !== "usd") return res.status(503).json({ error: "Equipment checkout requires USD pricing." });
    const discount = await resolveDiscount({ user, type, periods, productId: product.id });
    const quantity = room ? getCalendarMonthSelection(periods)?.count : countEquipmentReservationHours(periods);
    return res.status(200).json(priceQuote(product.default_price.unit_amount, quantity, product.currency, discount));
  } catch (error) {
    console.error("Reservation quote error:", error);
    return res.status(error.status || 503).json({ error: error.status ? error.message : "Pricing is currently unavailable. Please contact staff." });
  }
}
