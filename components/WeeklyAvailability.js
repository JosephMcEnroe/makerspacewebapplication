import { businessTime, businessCalendarDate } from "@/lib/businessTime";
import { useMemo, useState } from "react";
import styles from "./WeeklyAvailability.module.css";
import { buildReservationPeriods, formatMinutesAsTime, getReservationSlotStartMinutes, isUnavailableInterval, reservationCustomerEndDateTime, toggleReservationSlot } from "@/lib/reservationPeriods";
import { formatTimeRange } from "@/lib/format";
import { ROOM_BOOKING_ADVANCE_DAYS } from "@/lib/monthlyReservation";

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
  return businessCalendarDate(value);
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
  initialResourceId,
  initialSlots = [],
  confirmLabel = "Confirm Reservation",
  cancelLabel = "Keep Browsing",
  onConfirm,
  onClose,
}) {
  const alternatives = resource.alternatives || [resource];
  const [selectedResourceId, setSelectedResourceId] = useState(String(initialResourceId || resource.resourceId));
  const activeResource = alternatives.find((item) => String(item.resourceId) === selectedResourceId) || resource;
  const unavailableIntervalsForResource = activeResource.unavailableIntervals || [];
  const isRoom = type === "rooms";
  const isClass = type === "classes";
  const advanceDays = isRoom ? ROOM_BOOKING_ADVANCE_DAYS : 31;
  const cleanupMinutes = type === "equipment" ? 15 : 0;
  const availabilityBufferMinutes = type === "rooms" ? 15 : 0;
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
  const periods = useMemo(
    () => buildReservationPeriods(selectedSlots, { mergeAdjacent: type === "equipment" }),
    [selectedSlots, type]
  );

  const changeWeek = (amount) => {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
  };

  const isAvailable = (date, startMinute) => {
    if (activeResource.unavailable || (isClass && (!Number.isInteger(classMinute) || classMinute < 0 || classMinute > 59))) return false;
    const slotStart = new Date(`${date}T00:00:00`);
    slotStart.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setTime(slotStart.getTime() + 60 * 60 * 1000);
    const now = new Date();
    const bookingCutoff = new Date(now);
    bookingCutoff.setDate(bookingCutoff.getDate() + advanceDays);
    if (isClass) {
      if (date !== classDate || startMinute !== classHour * 60 + classMinute) return false;
      const classStartsAt = new Date(businessTime(`${date}T${pad(classHour)}:${pad(classMinute)}:00`));
      return classStartsAt > now && classStartsAt <= bookingCutoff;
    }
    const easternStart = businessTime(`${date}T${pad(Math.floor(startMinute / 60))}:${pad(startMinute % 60)}:00`);
    if (!Number.isFinite(easternStart) || easternStart <= now.getTime() || easternStart > bookingCutoff.getTime()) return false;
    return !unavailableIntervalsForResource.some((interval) =>
      isUnavailableInterval(interval, activeResource.reservationId, easternStart, easternStart + 60 * 60 * 1000, availabilityBufferMinutes)
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
      await onConfirm(periods, activeResource);
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
        <h2 id="availability-title" className={styles.title}>{alternatives.length > 1 ? resource.name : activeResource.displayName || activeResource.name}</h2>
        {alternatives.length > 1 && (
          <fieldset className={styles.machinePicker}>
            <legend>{isRoom ? "Choose a studio" : "Choose a machine"}</legend>
            <div className={styles.machineChoices}>
              {alternatives.map((alternative) => (
                <button
                  key={alternative.resourceId}
                  type="button"
                  className={`${styles.machineChoice} ${String(alternative.resourceId) === selectedResourceId ? styles.machineChoiceActive : ""}`}
                  aria-pressed={String(alternative.resourceId) === selectedResourceId}
                  disabled={alternative.unavailable}
                  onClick={() => {
                    setSelectedResourceId(String(alternative.resourceId));
                    setSelectedSlots([]);
                  }}
                >
                  {alternative.displayName || alternative.name}{alternative.unavailable ? " · Unavailable" : ""}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <p>All times are Eastern Time (EST)</p>
        <p className={styles.instructions}>{type === "classes"
          ? "Select the scheduled class time to reserve your spot."
          : isRoom
            ? "Choose one or more green time slots. Each reservation lasts one hour and requires a 15-minute buffer before the next. Rooms are bookable 24 hours a day."
            : "Choose one or more green time slots from 6:00 AM to 11:00 PM. Each machine reservation lasts one hour; please leave the machine 15 minutes before the reserved end time so staff can clean up."}</p>
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
        {periods.length > 0 && <ul className={styles.periodList}>{periods.map((period) => {
          const endDateTime = `${period.endDate}T${pad(Math.floor(period.endMinute / 60))}:${pad(period.endMinute % 60)}:00`;
          const displayEndDateTime = cleanupMinutes
            ? reservationCustomerEndDateTime(endDateTime, cleanupMinutes)
            : endDateTime;
          const displayRange = formatTimeRange(`${period.date}T${pad(Math.floor(period.startMinute / 60))}:${pad(period.startMinute % 60)}:00`, displayEndDateTime);
          return <li key={`${period.date}:${period.startMinute}`}>
            {displayRange}{cleanupMinutes ? " · 15 minutes reserved for staff cleanup" : ""}
          </li>;
        })}</ul>}
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
