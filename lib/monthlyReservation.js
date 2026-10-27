import { businessDateTime } from "./businessTime";

function wallTime(value) {
  return value instanceof Date || /[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(value))
    ? businessDateTime(value) : String(value).replace(" ", "T");
}

export function monthlyPeriod(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid start date.");
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.toISOString().slice(0, 10) !== date) throw new Error("Choose a valid start date.");
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  return { start: `${date}T00:00:00`, end: `${end.toISOString().slice(0, 10)}T00:00:00` };
}

export function calendarMonthPeriod(month, monthCount = 1) {
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)
    || !Number.isInteger(monthCount) || monthCount < 1 || monthCount > 12) {
    throw new Error("Choose a valid number of calendar months.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  if (start.toISOString().slice(0, 7) !== month) throw new Error("Choose a valid rental month.");
  const end = new Date(Date.UTC(year, monthNumber - 1 + monthCount, 1));
  return { start: `${month}-01T00:00:00`, end: `${end.toISOString().slice(0, 10)}T00:00:00` };
}

export function getCalendarMonthCount(start, end) {
  const startMatch = typeof start === "string" && start.match(/^(\d{4})-(\d{2})-01T00:00:00$/);
  const endMatch = typeof end === "string" && end.match(/^(\d{4})-(\d{2})-01T00:00:00$/);
  if (!startMatch || !endMatch) return null;
  const [, startYear, startMonth] = startMatch.map(Number);
  const [, endYear, endMonth] = endMatch.map(Number);
  const count = (endYear - startYear) * 12 + endMonth - startMonth;
  if (startMonth > 12 || endMonth > 12 || count < 1 || count > 12) return null;
  try {
    return calendarMonthPeriod(`${startYear}-${String(startMonth).padStart(2, "0")}`, count).end === end ? count : null;
  } catch { return null; }
}

export function getMonthlyReservationCount(start, end) {
  try {
    const startTime = wallTime(start);
    const endTime = wallTime(end);
    const calendarCount = getCalendarMonthCount(startTime, endTime);
    if (calendarCount !== null) return calendarCount;
    const legacyPeriod = monthlyPeriod(startTime.slice(0, 10));
    return startTime === legacyPeriod.start && endTime === legacyPeriod.end ? 1 : null;
  } catch { return null; }
}

export function monthlyReservationLabel(start, end) {
  const count = getMonthlyReservationCount(start, end);
  if (count === null) return null;
  const startTime = wallTime(start);
  const endTime = wallTime(end);
  const calendarCount = getCalendarMonthCount(startTime, endTime);
  if (calendarCount === null) return `${startTime.slice(0, 10)} – ${endTime.slice(0, 10)} (1 month)`;
  const startDate = new Date(`${startTime.slice(0, 10)}T00:00:00Z`);
  const endDate = new Date(`${endTime.slice(0, 10)}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const formatMonth = date => date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  const startLabel = formatMonth(startDate);
  const endLabel = formatMonth(endDate);
  return `${startLabel}${startLabel === endLabel ? "" : ` – ${endLabel}`} (${count} month${count === 1 ? "" : "s"})`;
}

export function isMonthlyPeriod(period) {
  if (!period) return false;
  if (getCalendarMonthCount(period.start, period.end) !== null) return true;
  try {
    const expected = monthlyPeriod(period.start?.slice(0, 10));
    return period.start === expected.start && period.end === expected.end;
  } catch { return false; }
}

export function isMonthlyReservation(start, end) {
  return getMonthlyReservationCount(start, end) !== null;
}
