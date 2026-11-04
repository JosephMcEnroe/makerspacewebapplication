import { businessDateTime, businessTime, BUSINESS_TIME_ZONE } from "../businessTime";

const DAY = 86400000;
function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function shift(value, days) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
export function resolveReportPeriod(query = {}, now = new Date()) {
  const today = businessDateTime(now).slice(0, 10);
  let start, end;
  const preset = query.preset ?? (query.start || query.end ? "custom" : "month_to_date");
  switch (preset) {
    case "today": start = end = today; break;
    case "week_to_date":
      start = shift(today, -new Date(`${today}T00:00:00Z`).getUTCDay()); end = today; break;
    case "month_to_date": start = `${today.slice(0, 7)}-01`; end = today; break;
    case "last_7_days": start = shift(today, -6); end = today; break;
    case "previous_month":
      end = shift(`${today.slice(0, 7)}-01`, -1); start = `${end.slice(0, 7)}-01`; break;
    case "custom": start = query.start; end = query.end; break;
    default: throw new Error("Choose a valid reporting period.");
  }
  if (!validDate(start) || !validDate(end)) throw new Error("Choose valid start and end dates.");
  if (start > end) throw new Error("Start date must be on or before end date.");
  if (start > today) throw new Error("The reporting period must begin today or earlier.");
  if ((Date.parse(end) - Date.parse(start)) / DAY + 1 > 366) throw new Error("Choose a range of 366 days or fewer.");
  end = end > today ? today : end;
  return { start, end, timezone: BUSINESS_TIME_ZONE, preset,
    startSeconds: Math.floor(businessTime(start) / 1000),
    endSeconds: Math.min(Math.floor(businessTime(shift(end, 1)) / 1000), Math.floor(now.getTime() / 1000)),
    generatedAt: now.toISOString() };
}
