import { useState } from "react";
import { calendarMonthPeriod, getMonthlyStartAvailability, ROOM_BOOKING_ADVANCE_DAYS } from "@/lib/monthlyReservation";
import { businessDateTime } from "@/lib/businessTime";
import styles from "./WeeklyAvailability.module.css";

const pad = value => String(value).padStart(2, "0");
const monthKey = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;

export default function MonthlyAvailability({ resource, initialDate = "", initialMonths = 1, initialSelectedMonths, lockMonthCount = false, unavailableIntervals = [], excludedReservationIds = [], onConfirm, onClose, confirmLabel = "Purchase studio months", cancelLabel = "Keep Browsing" }) {
  const alternatives = resource.alternatives || [resource];
  const [selectedResourceId, setSelectedResourceId] = useState(String(resource.initialResourceId || alternatives[0]?.resourceId || resource.resourceId));
  const activeResource = alternatives.find(item => String(item.resourceId) === selectedResourceId) || resource;
  const requestedMonths = Array.isArray(initialSelectedMonths) && initialSelectedMonths.length
    ? initialSelectedMonths.map(value => String(value).slice(0, 7))
    : (() => {
      const count = Number(initialMonths);
      const safeCount = Number.isInteger(count) && count >= 1 && count <= 12 ? count : 1;
      const startDate = initialDate.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(startDate)) return [];
      const [startYear, startMonth] = startDate.split("-").map(Number);
      return Array.from({ length: safeCount }, (_, index) => new Date(Date.UTC(startYear, startMonth - 1 + index, 1)).toISOString().slice(0, 7));
    })();
  const [selectedMonths, setSelectedMonths] = useState(requestedMonths);
  const requiredMonthCount = lockMonthCount ? requestedMonths.length : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const today = businessDateTime(now).slice(0, 10);
  const [year, currentMonth] = today.slice(0, 7).split("-").map(Number);
  const earliestDate = new Date(year, currentMonth, 1);
  const minMonth = monthKey(earliestDate);
  const maxMonth = monthKey(new Date(now + ROOM_BOOKING_ADVANCE_DAYS * 86400000));
  const finalVisibleMonth = maxMonth;
  const activeIntervals = activeResource.unavailableIntervals || unavailableIntervals;
  const excludedIds = [...new Set([activeResource.reservationId, ...excludedReservationIds].filter(id => id != null).map(String))];
  const monthAvailability = getMonthlyStartAvailability(minMonth, finalVisibleMonth, 1, activeIntervals, excludedIds, maxMonth);
  const availabilityByMonth = new Map(monthAvailability.map(item => [item.month, item]));
  const normalizedMonths = [...new Set(selectedMonths)].sort();
  const periods = normalizedMonths.map(selectedMonth => calendarMonthPeriod(selectedMonth, 1));
  const selectionAvailable = normalizedMonths.length > 0 && normalizedMonths.length <= 12
    && normalizedMonths.every(selectedMonth => availabilityByMonth.get(selectedMonth)?.available);
  const valid = selectionAvailable && (!requiredMonthCount || normalizedMonths.length === requiredMonthCount);
  const rangeLabel = normalizedMonths.map(selectedMonth => new Date(`${selectedMonth}-01T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })).join(", ");
  function toggleMonth(selectedMonth) {
    setSelectedMonths(current => current.includes(selectedMonth)
      ? current.filter(monthKeyValue => monthKeyValue !== selectedMonth)
      : current.length < 12 ? [...current, selectedMonth] : current);
  }
  async function confirm() {
    setSubmitting(true);
    setError("");
    try { await onConfirm(periods, activeResource); }
    catch (err) { setError(err.message || "Could not purchase the studio rental."); setSubmitting(false); }
  }

  return <div className={styles.backdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="monthly-title">
    <h2 id="monthly-title" className={styles.title}>{alternatives.length > 1 ? resource.name : activeResource.displayName || activeResource.name}</h2>
    {alternatives.length > 1 && <fieldset className={styles.machinePicker}>
      <legend>Choose a studio</legend>
      <div className={styles.machineChoices}>{alternatives.map(alternative => <button
        key={alternative.resourceId}
        type="button"
        className={`${styles.machineChoice} ${String(alternative.resourceId) === selectedResourceId ? styles.machineChoiceActive : ""}`}
        aria-pressed={String(alternative.resourceId) === selectedResourceId}
        disabled={alternative.unavailable}
        onClick={() => setSelectedResourceId(String(alternative.resourceId))}
      >{alternative.displayName || alternative.name}</button>)}</div>
    </fieldset>}
    <section className={styles.availabilitySection} aria-labelledby="available-months-title">
      <h3 id="available-months-title">Select rental months</h3>
      <p>Choose up to 12 available months. Rentals can begin up to one year ahead.</p>
      <div className={styles.monthAvailability}>
        {monthAvailability.map(({ month: availableMonth, available, status }) => {
          const label = new Date(`${availableMonth}-01T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
          const labelByStatus = { available: "Available", reserved: "Already reserved", outsideWindow: "Outside booking window" };
          const selected = normalizedMonths.includes(availableMonth);
          const disabled = submitting || (!available && !selected) || (!selected && normalizedMonths.length >= 12)
            || (lockMonthCount && !selected && normalizedMonths.length >= requiredMonthCount);
          return <button key={availableMonth} type="button" className={`${styles.monthChoice} ${available ? styles.monthAvailable : styles.monthUnavailable}`}
            aria-pressed={selected} disabled={disabled} onClick={() => toggleMonth(availableMonth)}>
            <span>{label}</span><span>{selected ? "Selected" : labelByStatus[status]}</span>
          </button>;
        })}
      </div>
      {monthAvailability.every(({ available }) => !available) && <p>No rental months are available within the booking window.</p>}
      <p className={styles.selectionSummary} aria-live="polite">{normalizedMonths.length} month{normalizedMonths.length === 1 ? "" : "s"} selected{rangeLabel ? `: ${rangeLabel}` : ""}</p>
      {normalizedMonths.length > 12 && <p role="alert">A rental can include at most 12 months.</p>}
      {lockMonthCount && normalizedMonths.length !== requiredMonthCount && <p role="alert">Select exactly {requiredMonthCount} months to keep the purchased rental length.</p>}
    </section>
    {!selectionAvailable && normalizedMonths.length > 0 && <p role="alert">Remove unavailable months before continuing.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" onClick={onClose} disabled={submitting} className={styles.secondaryButton}>{cancelLabel}</button>
      <button type="button" className={styles.primaryButton} disabled={!valid || submitting} onClick={confirm}>{submitting ? "Processing…" : confirmLabel}</button></div>
  </section></div>;
}
