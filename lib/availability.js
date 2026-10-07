// Placeholder availability data until it is wired up to the database.
// Studio opening hours in 24h "HH:MM" format. Days missing from this table
// (currently Sunday) are treated as closed.
export const OPENING_HOURS = {
  // 0 = Sunday — closed, so it is omitted
  1: { open: "09:00", close: "20:00" }, // Monday
  2: { open: "09:00", close: "20:00" }, // Tuesday
  3: { open: "09:00", close: "20:00" }, // Wednesday
  4: { open: "09:00", close: "20:00" }, // Thursday
  5: { open: "09:00", close: "18:00" }, // Friday
  6: { open: "10:00", close: "16:00" }, // Saturday
};

// Placeholder booked/reserved blocks per resource type, keyed by type
// ("class" | "room" | "equipment"). `day` is 0-6 (Sunday-Saturday).
export const BOOKED_BLOCKS = {
  class: [
    { day: 1, start: "16:15", end: "18:15", label: "Beginner Laser Cutting" },
    { day: 2, start: "18:30", end: "20:00", label: "Advanced 3D Printing" },
    { day: 3, start: "14:00", end: "16:00", label: "Woodworking Workshop" },
  ],
  room: [
    { day: 1, start: "10:00", end: "13:00", label: "Reserved" },
    { day: 3, start: "17:00", end: "20:00", label: "Reserved" },
    { day: 5, start: "09:00", end: "12:00", label: "Reserved" },
  ],
  equipment: [
    { day: 1, start: "16:15", end: "18:15", label: "In use" },
    { day: 2, start: "13:00", end: "16:00", label: "In use" },
    { day: 4, start: "10:00", end: "12:30", label: "In use" },
  ],
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Width of one timetable cell, in minutes
export const SLOT_MINUTES = 60;

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function to12h(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/**
 * Builds a week of availability for a resource type as discrete slots
 * (available = green, unavailable = gray in the timetable UI).
 * Returns one row per day plus the shared time axis values so the UI
 * can render every day on the same scale.
 */
export function getWeekAvailability(type, weekStart) {
  const typeKey = { rooms: "room", classes: "class", equipment: "equipment" }[type] || type;
  const isRoom = typeKey === "room";
  const maxAdvanceMonths = isRoom ? 3 : 1;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastBookableDate = new Date(today);
  lastBookableDate.setMonth(lastBookableDate.getMonth() + maxAdvanceMonths);
  const roomHours = { open: "00:00", close: "24:00" };
  const getHours = (day) => (isRoom ? roomHours : OPENING_HOURS[day]);
  const openRanges = [];
  for (let day = 0; day < 7; day += 1) {
    const hours = getHours(day);
    if (hours) {
      openRanges.push({ day, start: toMinutes(hours.open), end: toMinutes(hours.close) });
    }
  }

  // Shared time axis: earliest open to latest close across the week
  const gridStart = Math.min(...openRanges.map((range) => range.start));
  const gridEnd = Math.max(...openRanges.map((range) => range.end));
  const booked = BOOKED_BLOCKS[typeKey] || [];

  const days = [];
  for (let day = 0; day < 7; day += 1) {
    const weekDate = new Date(weekStart);
    weekDate.setDate(weekStart.getDate() + day);
    const hours = getHours(day);
    const dayBlocks = booked
      .filter((block) => block.day === day)
      .map((block) => ({
        ...block,
        startMin: toMinutes(block.start),
        endMin: toMinutes(block.end),
      }));

    const slots = [];
    for (let start = gridStart; start < gridEnd; start += SLOT_MINUTES) {
      const end = start + SLOT_MINUTES;
      const slotDateTime = new Date(weekDate);
      slotDateTime.setHours(Math.floor(start / 60), start % 60, 0, 0);
      const isBeforeNow = slotDateTime < now;
      const isBeyondBookingWindow =
        new Date(weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate()) > lastBookableDate;

      if (isBeforeNow) {
        slots.push({ start, end, available: false, label: "Past" });
        continue;
      }

      if (isBeyondBookingWindow) {
        slots.push({ start, end, available: false, label: "Outside booking window" });
        continue;
      }

      if (!hours) {
        slots.push({ start, end, available: false, label: "Closed" });
        continue;
      }

      const openMin = toMinutes(hours.open);
      const closeMin = toMinutes(hours.close);

      if (start < openMin || end > closeMin) {
        slots.push({ start, end, available: false, label: "Closed" });
        continue;
      }

      const block = dayBlocks.find(
        (b) => b.startMin < end && b.endMin > start
      );
      slots.push(
        block
          ? { start, end, available: false, label: block.label }
          : { start, end, available: true, label: "" }
      );
    }

    days.push({
      day,
      date: weekDate,
      name: DAY_NAMES[day],
      isClosed: !hours,
      openLabel: hours
        ? `${to12h(toMinutes(hours.open))} – ${to12h(toMinutes(hours.close))}`
        : "Closed",
      slots,
      gridStart,
      gridEnd,
    });
  }

  return { days, gridStart, gridEnd, hoursSpan: gridEnd - gridStart };
}

export { to12h };
