import Stripe from "stripe";

const TIMEZONE = "America/New_York";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
function dayKey(date) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function calendarDay(date) { return date.toISOString().slice(0, 10); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
  }

  try {
    const now = new Date();
    const today = dayKey(now);
    // UTC dates represent calendar dates here, not business-time midnight.
    const calendar = new Date(`${today}T00:00:00Z`);
    const monday = new Date(calendar);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const weekStart = calendarDay(monday);
    const monthStart = `${today.slice(0, 7)}-01`;
    const dailyRevenue = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(calendar);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      return {
        date: calendarDay(date),
        label: date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
        value: 0,
      };
    });
    const earliestDay = [monthStart, weekStart, dailyRevenue[0].date].sort()[0];
    const totals = { today: 0, thisWeek: 0, thisMonth: 0 };
    const dailyAmounts = Object.fromEntries(dailyRevenue.map((day) => [day.date, 0]));
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // Fetch a one-day cushion, then filter by Eastern calendar date below.
    // This handles DST without relying on the server's timezone.
    for await (const charge of stripe.charges.list({
      limit: 100,
      created: {
        gte: Date.parse(`${earliestDay}T00:00:00Z`) / 1000 - 86400,
        lt: Math.floor(now.getTime() / 1000) + 1,
      },
    })) {
      if (!charge.paid || !charge.captured || charge.status !== "succeeded" || charge.currency !== "usd") continue;
      const date = dayKey(new Date(charge.created * 1000));
      if (date < earliestDay || date > today) continue;
      // Gross captured sales: refunds and Stripe fees are not deducted.
      const amount = charge.amount_captured;
      if (date === today) totals.today += amount;
      if (date >= weekStart) totals.thisWeek += amount;
      if (date >= monthStart) totals.thisMonth += amount;
      if (Object.hasOwn(dailyAmounts, date)) dailyAmounts[date] += amount;
    }
    return res.status(200).json({
      ...Object.fromEntries(Object.entries(totals).map(([name, cents]) => [name, cents / 100])),
      dailyRevenue: dailyRevenue.map((day) => ({ ...day, value: dailyAmounts[day.date] / 100 })),
      currency: "usd",
      timezone: TIMEZONE,
      basis: "gross_captured_sales",
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load Stripe revenue" });
  }
}
