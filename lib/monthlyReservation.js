import { businessDateTime } from "./businessTime";

export function isMonthlyReservation(start, end) {
  try {
    const wallTime = value => value instanceof Date || /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
      ? businessDateTime(value) : String(value).replace(" ", "T");
    const startTime = wallTime(start);
    const expected = monthlyPeriod(startTime.slice(0, 10));
    return startTime === expected.start && wallTime(end) === expected.end;
  } catch { return false; }
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
