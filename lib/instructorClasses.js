import { businessDateTime } from "./businessTime";
import { formatMinutesAsTime } from "./reservationPeriods";
import { getResourceImage } from "./resourceImages";

// Classes are booked into one-hour reservation slots (see lib/reservationPeriods.js);
// "class" rows only store the start time, so the end is start + one slot.
export const CLASS_DURATION_MINUTES = 60;

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}$/;

// class_date arrives as a Date (parsed in lib/db.js) or a string; either way the
// fields we use are the business's Eastern wall-clock values.
function classStart(value) {
  if (!value) return null;
  const match = businessDateTime(value).match(WALL_CLOCK);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    dateKey: `${year}-${month}-${day}`,
    startsAt: `${year}-${month}-${day}T${hour}:${minute}`,
    startMinute: Number(hour) * 60 + Number(minute),
  };
}

function longDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC", weekday: "long", month: "long", day: "numeric",
  });
}

function cardDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric",
  });
}

function shortDateLabel(dateKey) {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}`;
}

function studentsLabel(enrolled, capacity) {
  if (capacity) return `${enrolled}/${capacity} students`;
  return `${enrolled} student${enrolled === 1 ? "" : "s"}`;
}

// Turns one "class" row into the shape the instructor dashboard renders.
// Returns null for rows without a usable start time.
export function toInstructorClass(row) {
  const start = classStart(row?.class_date);
  if (!start) return null;

  const enrolled = Number(row.enrolled) || 0;
  const capacity = row.max_capacity == null ? null : Number(row.max_capacity);
  const endMinute = start.startMinute + CLASS_DURATION_MINUTES;

  return {
    id: `class-${row.class_id}`,
    resourceId: String(row.class_id),
    name: row.name_of_class || "Untitled class",
    description: row.description || "",
    date: start.dateKey,
    startsAt: start.startsAt,
    timeRange: `${formatMinutesAsTime(start.startMinute)} – ${formatMinutesAsTime(endMinute)}`,
    dateLabel: longDateLabel(start.dateKey),
    cardDateLabel: cardDateLabel(start.dateKey),
    shortDateLabel: shortDateLabel(start.dateKey),
    enrolled,
    capacity,
    studentsLabel: studentsLabel(enrolled, capacity),
    image: getResourceImage(`class-${row.class_id}`),
  };
}

// Groups an instructor's classes into the dashboard's three sections.
// "today" is a business-time date key (YYYY-MM-DD).
export function buildInstructorClasses(rows, today) {
  const classes = (Array.isArray(rows) ? rows : [])
    .map(toInstructorClass)
    .filter(Boolean)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return {
    today: classes.filter((item) => item.date === today),
    upcoming: classes.filter((item) => item.date > today),
    past: classes.filter((item) => item.date < today),
  };
}
