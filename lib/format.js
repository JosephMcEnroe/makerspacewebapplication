// Display helpers for values coming back from Postgres. pg returns DATE /
// TIMESTAMP columns as Date objects, which getServerSideProps can't serialize,
// so pages convert them to strings with these before passing them as props.

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "2026-05-01" - the format <input type="date"> expects
export function toISODate(value) {
  const date = toDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "May 1, 2026"
export function formatDate(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

export function formatYear(value) {
  const date = toDate(value);
  return date ? String(date.getFullYear()) : "";
}

// Accepts a TIME column ("16:15:00") or a Date and returns "4:15 PM"
export function formatTime(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
    const suffix = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
  }

  const date = toDate(value);
  return date ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

// "May 1, 2026 4:15 PM - 6:15 PM"
export function formatTimeRange(start, end) {
  const startDate = toDate(start);
  if (!startDate) return "";

  const startText = `${formatDate(startDate)} ${formatTime(startDate)}`;
  const endDate = toDate(end);
  if (!endDate) return startText;

  const sameDay = formatDate(startDate) === formatDate(endDate);
  return `${startText} - ${sameDay ? formatTime(endDate) : `${formatDate(endDate)} ${formatTime(endDate)}`}`;
}
