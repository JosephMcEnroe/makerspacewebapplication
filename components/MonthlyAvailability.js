import { useState } from "react";
import { calendarMonthPeriod, monthlyReservationLabel } from "@/lib/monthlyReservation";
import { businessDateTime, businessTime } from "@/lib/businessTime";
import styles from "./WeeklyAvailability.module.css";

const pad = value => String(value).padStart(2, "0");
const monthKey = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;

export default function MonthlyAvailability({ resource, initialDate = "", initialMonths = 1, lockMonthCount = false, unavailableIntervals = [], onConfirm, onClose, confirmLabel = "Purchase studio months", cancelLabel = "Keep Browsing" }) {
  const alternatives = resource.alternatives || [resource];
  const [selectedResourceId, setSelectedResourceId] = useState(String(resource.initialResourceId || alternatives[0]?.resourceId || resource.resourceId));
  const activeResource = alternatives.find(item => String(item.resourceId) === selectedResourceId) || resource;
  const [month, setMonth] = useState(() => initialDate.slice(0, 7));
  const [monthCount, setMonthCount] = useState(initialMonths);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const today = businessDateTime(now).slice(0, 10);
  const [year, currentMonth] = today.slice(0, 7).split("-").map(Number);
  const earliestDate = new Date(year, currentMonth, 1);
  const minMonth = monthKey(earliestDate);
  const maxMonth = monthKey(new Date(now + 90 * 86400000));
  let period;
  try { period = calendarMonthPeriod(month, monthCount); } catch { /* No valid selection yet. */ }
  const validStart = period && month >= minMonth && month <= maxMonth && businessTime(period.start) > now;
  const activeIntervals = activeResource.unavailableIntervals || unavailableIntervals;
  const conflict = validStart && activeIntervals.some(interval => String(interval.reservationId) !== String(activeResource.reservationId)
    && businessTime(interval.start) < businessTime(period.end) && businessTime(interval.end) > businessTime(period.start));
  const valid = validStart && !conflict;
  const rangeLabel = period && monthlyReservationLabel(period.start, period.end);
  async function confirm() {
    setSubmitting(true);
    setError("");
    try { await onConfirm([period], activeResource); }
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
    <p>Select a calendar month and how many consecutive months to rent. The studio is yours from the first through the last day of each month; the one-time purchase charges the monthly price for every month selected.</p>
    <label>First rental month <input type="month" value={month} min={minMonth} max={maxMonth} disabled={submitting} onChange={event => setMonth(event.target.value)} /></label>{" "}
    <label>Number of months <select value={monthCount} disabled={submitting || lockMonthCount} onChange={event => setMonthCount(Number(event.target.value))}>
      {Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} month{count === 1 ? "" : "s"}</option>)}
    </select></label>
    {lockMonthCount && <p>The number of paid months can’t be changed when editing a rental.</p>}
    {period && <p aria-live="polite">Rental: {rangeLabel}. Ends at midnight on {period.end.slice(0, 10)}.</p>}
    {!validStart && month && <p role="alert">Choose a future month beginning within 90 days.</p>}
    {conflict && <p role="alert">This studio is unavailable during part of the selected month range.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" onClick={onClose} disabled={submitting} className={styles.secondaryButton}>{cancelLabel}</button>
      <button type="button" className={styles.primaryButton} disabled={!valid || submitting} onClick={confirm}>{submitting ? "Processing…" : confirmLabel}</button></div>
  </section></div>;
}
