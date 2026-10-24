import { businessDateTime, businessTime } from "./businessTime";

export const RESERVATION_BUFFER_MINUTES = 15;
export const SLOT_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;
const FINAL_ROOM_SLOT_START = 22 * 60 + 30;
const FIRST_EQUIPMENT_SLOT_START = 6 * 60;
const FINAL_EQUIPMENT_SLOT_START = 22 * 60;

export function getReservationSlotStartMinutes(type) {
  if (type === "equipment") {
    return Array.from(
      { length: (FINAL_EQUIPMENT_SLOT_START - FIRST_EQUIPMENT_SLOT_START) / SLOT_DURATION_MINUTES + 1 },
      (_, index) => FIRST_EQUIPMENT_SLOT_START + index * SLOT_DURATION_MINUTES
    );
  }

  const interval = SLOT_DURATION_MINUTES + RESERVATION_BUFFER_MINUTES;
  const starts = [];

  for (let start = 0; start + SLOT_DURATION_MINUTES + RESERVATION_BUFFER_MINUTES <= FINAL_ROOM_SLOT_START; start += interval) {
    starts.push(start);
  }
  starts.push(FINAL_ROOM_SLOT_START);
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

export function isValidEquipmentReservation(type, period) {
  if (type !== "equipment" || !period || !isAllowedReservationStart(type, period.start)) return false;
  const start = localDateTimeMinutes(period.start);
  const end = localDateTimeMinutes(period.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const startDate = period.start.slice(0, 10);
  const endDate = period.end.slice(0, 10);
  const startMinute = Number(period.start.slice(11, 13)) * 60 + Number(period.start.slice(14, 16));
  const endMinute = Number(period.end.slice(11, 13)) * 60 + Number(period.end.slice(14, 16));
  const duration = end - start;
  return endDate === startDate && startMinute >= FIRST_EQUIPMENT_SLOT_START
    && endMinute <= FINAL_EQUIPMENT_SLOT_START + SLOT_DURATION_MINUTES
    && duration >= SLOT_DURATION_MINUTES * 60 * 1000
    && duration % (SLOT_DURATION_MINUTES * 60 * 1000) === 0;
}

function periodBounds(period) {
  if (typeof period.start === "string" && typeof period.end === "string") {
    return { start: localDateTimeMinutes(period.start), end: localDateTimeMinutes(period.end) };
  }
  const toMinutes = (date, minute) => {
    const match = typeof date === "string" && date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || !Number.isInteger(minute)) return Number.NaN;
    const [, year, month, day] = match.map(Number);
    const timestamp = Date.UTC(year, month - 1, day, 0, minute);
    const parsed = new Date(timestamp);
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? timestamp
      : Number.NaN;
  };
  return {
    start: toMinutes(period.date, period.startMinute),
    end: toMinutes(period.endDate, period.endMinute),
  };
}

export function mergeAdjacentReservationPeriods(periods) {
  const sorted = periods.map((period) => ({ period: { ...period }, ...periodBounds(period) }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    if (previous && Number.isFinite(current.start) && current.start === previous.end) {
      if (typeof current.period.start === "string") previous.period.end = current.period.end;
      else {
        previous.period.endDate = current.period.endDate;
        previous.period.endMinute = current.period.endMinute;
      }
      previous.end = current.end;
    } else {
      merged.push(current);
    }
  }
  return merged.map(({ period }) => period);
}

export function countEquipmentReservationHours(periods) {
  const duration = periods.reduce((total, period) => {
    const { start, end } = periodBounds(period);
    return total + end - start;
  }, 0);
  const hour = SLOT_DURATION_MINUTES * 60 * 1000;
  return Number.isFinite(duration) && duration > 0 && duration % hour === 0 ? duration / hour : Number.NaN;
}

export function hasReservationBuffer(periods, bufferMinutes = RESERVATION_BUFFER_MINUTES) {
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) return false;
  const sorted = [...periods].sort((a, b) => localDateTimeMinutes(a.start) - localDateTimeMinutes(b.start));
  const bufferMs = bufferMinutes * 60 * 1000;
  return sorted.every((period, index) => {
    const start = localDateTimeMinutes(period.start);
    const end = localDateTimeMinutes(period.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    if (index === 0) return true;
    return start - localDateTimeMinutes(sorted[index - 1].end) >= bufferMs;
  });
}

export function reservationCustomerEndDateTime(end, cleanupMinutes = 15) {
  const text = end instanceof Date ? businessDateTime(end) : end;
  const match = typeof text === "string" && text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/);
  if (!match || !Number.isInteger(cleanupMinutes) || cleanupMinutes < 0) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  date.setUTCMinutes(date.getUTCMinutes() - cleanupMinutes);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

export function reservationCustomerEnd(end, cleanupMinutes = 15) {
  const customerEnd = reservationCustomerEndDateTime(end, cleanupMinutes);
  if (!customerEnd) return null;
  const [date, time] = customerEnd.split("T");
  const [hour, minute] = time.split(":").map(Number);
  return { date, time: formatMinutesAsTime(hour * 60 + minute) };
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

export function isUnavailableInterval(interval, excludedReservationId, slotStart, slotEnd, bufferMinutes = RESERVATION_BUFFER_MINUTES) {
  if (excludedReservationId != null && String(interval.reservationId) === String(excludedReservationId)) return false;
  const intervalStart = businessTime(interval.start);
  const intervalEnd = businessTime(interval.end);
  const bufferMs = bufferMinutes * 60 * 1000;
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

export function buildReservationPeriods(slots, { mergeAdjacent = false } = {}) {
  const periods = [...slots]
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
  return mergeAdjacent ? mergeAdjacentReservationPeriods(periods) : periods;
}
