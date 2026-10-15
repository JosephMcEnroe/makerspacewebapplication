export const RESERVATION_BUFFER_MINUTES = 15;
export const SLOT_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;
const FINAL_SLOT_START = 22 * 60 + 30;

export function getReservationSlotStartMinutes(type) {
  const firstStart = type === "rooms" ? 0 : 8 * 60;
  const interval = SLOT_DURATION_MINUTES + RESERVATION_BUFFER_MINUTES;
  const starts = [];

  for (let start = firstStart; start + SLOT_DURATION_MINUTES + RESERVATION_BUFFER_MINUTES <= FINAL_SLOT_START; start += interval) {
    starts.push(start);
  }
  starts.push(FINAL_SLOT_START);
  return starts;
}

export function isAllowedReservationStart(type, start) {
  let minutes = start;
  if (typeof start === "string") {
    const match = start.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):00$/);
    if (!match) return false;
    minutes = Number(match[1]) * 60 + Number(match[2]);
  }
  return Number.isInteger(minutes) && getReservationSlotStartMinutes(type).includes(minutes);
}

function localDateTimeMinutes(value) {
  if (typeof value !== "string") return Number.NaN;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00$/);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || hour > 23 || minute > 59 || minute % 15 !== 0) return Number.NaN;
  return Date.UTC(year, month - 1, day, hour, minute);
}

export function isValidReservationPeriod(type, period) {
  if (!period || !isAllowedReservationStart(type, period.start)) return false;
  const start = localDateTimeMinutes(period.start);
  const end = localDateTimeMinutes(period.end);
  return Number.isFinite(start) && end - start === SLOT_DURATION_MINUTES * 60 * 1000;
}

export function hasReservationBuffer(periods) {
  const sorted = [...periods].sort((a, b) => localDateTimeMinutes(a.start) - localDateTimeMinutes(b.start));
  const bufferMs = RESERVATION_BUFFER_MINUTES * 60 * 1000;
  return sorted.every((period, index) => {
    const start = localDateTimeMinutes(period.start);
    const end = localDateTimeMinutes(period.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    if (index === 0) return true;
    return start - localDateTimeMinutes(sorted[index - 1].end) >= bufferMs;
  });
}

export function formatMinutesAsTime(minutes) {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function nextDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isUnavailableInterval(interval, excludedReservationId, slotStart, slotEnd) {
  if (excludedReservationId != null && String(interval.reservationId) === String(excludedReservationId)) return false;
  const intervalStart = new Date(interval.start).getTime();
  const intervalEnd = new Date(interval.end).getTime();
  const bufferMs = RESERVATION_BUFFER_MINUTES * 60 * 1000;
  return !Number.isNaN(intervalStart) && !Number.isNaN(intervalEnd)
    && intervalStart < slotEnd + bufferMs
    && intervalEnd > slotStart - bufferMs;
}

export function toggleReservationSlot(slots, slot, isAvailable) {
  const key = `${slot.date}:${slot.startMinute}`;
  const isSelected = slots.some((current) => `${current.date}:${current.startMinute}` === key);
  if (isSelected) return slots.filter((current) => `${current.date}:${current.startMinute}` !== key);
  if (!isAvailable) return slots;
  return [...slots, slot];
}

export function buildReservationPeriods(slots) {
  return [...slots]
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute)
    .map((slot) => {
      const endMinute = slot.startMinute + SLOT_DURATION_MINUTES;
      const crossesMidnight = endMinute >= MINUTES_PER_DAY;
      return {
        date: slot.date,
        startMinute: slot.startMinute,
        endDate: crossesMidnight ? nextDate(slot.date) : slot.date,
        endMinute: endMinute % MINUTES_PER_DAY,
      };
    });
}
