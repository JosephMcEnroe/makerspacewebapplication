import { useMemo, useState } from "react";
import styles from "./WeeklyAvailability.module.css";
import { buildReservationPeriods, formatMinutesAsTime, getReservationSlotStartMinutes, isUnavailableInterval, toggleReservationSlot } from "@/lib/reservationPeriods";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (value) => String(value).padStart(2, "0");

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(minutes) {
  return formatMinutesAsTime(minutes);
}

function parseLocalDate(value) {
  if (typeof value === "string" && value.length === 10 && value[4] === "-" && value[7] === "-") {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function getWeekStart(value) {
  const date = parseLocalDate(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export default function WeeklyAvailability({
  resource,
  type,
  initialDate,
  unavailableIntervals = [],
  initialSlots = [],
  confirmLabel = "Confirm Reservation",
  cancelLabel = "Keep Browsing",
  onConfirm,
  onClose,
}) {
  const isRoom = type === "rooms";
  const isClass = type === "classes";
  const advanceDays = isRoom ? 90 : 31;
  const classDate = type === "classes" && resource.scheduledDate ? resource.scheduledDate.slice(0, 10) : null;
  const classTimeMatch = type === "classes" && resource.scheduledTime
    ? String(resource.scheduledTime).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i)
    : null;
  let classHour = classTimeMatch ? Number(classTimeMatch[1]) : null;
  const classMinute = classTimeMatch ? Number(classTimeMatch[2]) : null;
  if (classTimeMatch?.[3]) {
    classHour = (classHour % 12) + (classTimeMatch[3].toUpperCase() === "PM" ? 12 : 0);
  }
  const [weekStart, setWeekStart] = useState(() => getWeekStart(initialDate || new Date()));
  const [selectedSlots, setSelectedSlots] = useState(initialSlots);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }), [weekStart]);
  const slotStarts = useMemo(() => isClass
    ? Number.isInteger(classHour) && classHour >= 0 && classHour < 24 ? [classHour * 60 + classMinute] : []
    : getReservationSlotStartMinutes(type), [classHour, classMinute, isClass, type]);
  const periods = useMemo(() => buildReservationPeriods(selectedSlots), [selectedSlots]);

  const changeWeek = (amount) => {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
  };

  const isAvailable = (date, startMinute) => {
    if (isClass && (!Number.isInteger(classMinute) || classMinute < 0 || classMinute > 59)) return false;
    const slotStart = new Date(`${date}T00:00:00`);
    slotStart.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setTime(slotStart.getTime() + 60 * 60 * 1000);
    const now = new Date();
    const bookingCutoff = new Date(now);
    bookingCutoff.setDate(bookingCutoff.getDate() + advanceDays);
    if (isClass) {
      if (date !== classDate || startMinute !== classHour * 60 + classMinute) return false;
      const classStartsAt = new Date(`${date}T${pad(classHour)}:${pad(classMinute)}:00`);
      return classStartsAt > now && classStartsAt <= bookingCutoff;
    }
    if (slotStart <= now || slotStart > bookingCutoff) return false;
    return !unavailableIntervals.some((interval) =>
      isUnavailableInterval(interval, resource.reservationId, slotStart.getTime(), slotEnd.getTime())
    );
  };

  const toggleSlot = (date, startMinute) => {
    const slot = { date, startMinute };
    const isSelected = selectedSlots.some((current) => current.date === date && current.startMinute === startMinute);
    setSelectedSlots((current) => toggleReservationSlot(current, slot, isSelected || isAvailable(date, startMinute)));
  };

  const confirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(periods);
    } catch (submitError) {
      setError(submitError.message || "Could not create the reservation.");
      setSubmitting(false);
    }
  };

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="availability-title">
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close availability">×</button>
        <p className={styles.eyebrow}>{type === "classes" ? "Class" : isRoom ? "Room" : "Equipment"} Reservation</p>
        <h2 id="availability-title" className={styles.title}>{resource.name}</h2>
        <p className={styles.instructions}>{type === "classes" ? "Select the scheduled class time to reserve your spot." : `Choose one or more green time slots. Each reservation lasts one hour and requires a 15-minute buffer before the next; the last slot is 10:30–11:30 PM with a 30-minute closing buffer. ${isRoom ? "Rooms are bookable 24 hours a day." : ""}`}</p>
        <div className={styles.legend}>
          <span><i className={styles.availableSwatch} /> Available</span>
          <span><i className={styles.unavailableSwatch} /> Unavailable</span>
          <span><i className={styles.selectedSwatch} /> Selected</span>
        </div>
        {type !== "classes" && <div className={styles.weekControls}>
          <button type="button" onClick={() => changeWeek(-1)} aria-label="Previous week">‹</button>
          <strong>{weekLabel}</strong>
          <button type="button" onClick={() => changeWeek(1)} aria-label="Next week">›</button>
        </div>}
        <div className={styles.tableScroller}>
          <table className={`${styles.table} ${isRoom ? styles.roomTable : ""}`}>
            <thead><tr><th scope="col">Time</th>{days.map((day) => <th key={dateKey(day)} scope="col">{DAY_LABELS[day.getDay()]}<small>{day.getDate()}</small></th>)}</tr></thead>
            <tbody>{slotStarts.map((startMinute) => <tr key={startMinute}>
              <th scope="row">{formatTime(startMinute)}–{formatTime(startMinute + 60)}</th>
              {days.map((day) => {
                const date = dateKey(day);
                const key = `${date}:${startMinute}`;
                const selected = selectedSlots.some((slot) => `${slot.date}:${slot.startMinute}` === key);
                const available = isAvailable(date, startMinute);
                return <td key={date}>
                  <button
                    type="button"
                    className={`${styles.slot} ${selected ? styles.selected : available ? styles.available : styles.unavailable}`}
                    aria-label={`${selected ? "Selected" : available ? "Available" : "Unavailable"}: ${date}, ${formatTime(startMinute)}–${formatTime(startMinute + 60)}`}
                    aria-pressed={selected}
                    disabled={!selected && !available}
                    onClick={() => toggleSlot(date, startMinute)}
                  />
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.selectionSummary} aria-live="polite">
          {selectedSlots.length === 0 ? "No times selected" : `${selectedSlots.length} hour${selectedSlots.length === 1 ? "" : "s"} selected · ${periods.length} reservation period${periods.length === 1 ? "" : "s"}`}
        </p>
        {periods.length > 0 && <ul className={styles.periodList}>{periods.map((period) => <li key={`${period.date}:${period.startMinute}`}>
          {new Date(`${period.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · {formatTime(period.startMinute)}–{formatTime(period.endMinute)}{period.endDate !== period.date ? ` (${new Date(`${period.endDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}
        </li>)}</ul>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>{cancelLabel}</button>
          <button type="button" className={styles.primaryButton} onClick={confirm} disabled={periods.length === 0 || submitting}>
            {submitting ? "Saving…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
