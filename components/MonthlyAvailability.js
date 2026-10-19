import { useState } from "react";
import { monthlyPeriod } from "@/lib/monthlyReservation";
import { businessDateTime, businessTime } from "@/lib/businessTime";
import styles from "./WeeklyAvailability.module.css";

export default function MonthlyAvailability({ resource, initialDate = "", unavailableIntervals = [], onConfirm, onClose, confirmLabel = "Create Reservation", cancelLabel = "Keep Browsing" }) {
  const [date, setDate] = useState(initialDate.slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  let period;
  try { period = monthlyPeriod(date); } catch { /* Empty or invalid date. */ }
  const today = businessDateTime(now).slice(0, 10);
  const maxDate = businessDateTime(now + 90 * 86400000).slice(0, 10);
  const conflict = period && unavailableIntervals.some(interval => String(interval.reservationId) !== String(resource.reservationId)
    && businessTime(interval.start) < businessTime(period.end) && businessTime(interval.end) > businessTime(period.start));
  const valid = period && date > today && date <= maxDate && !conflict;
  async function confirm() {
    setSubmitting(true); setError("");
    try { await onConfirm([period]); } catch (err) { setError(err.message); setSubmitting(false); }
  }
  return <div className={styles.backdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="monthly-title">
    <h2 id="monthly-title" className={styles.title}>{resource.name}</h2>
    <p>Choose a start date within 90 days. Rental runs from midnight Eastern Time until the same date next month (or its last day), at one monthly price.</p>
    <label>Rental start date <input type="date" value={date} min={today} max={maxDate} disabled={submitting} onChange={e => setDate(e.target.value)} /></label>
    {period && <p aria-live="polite">Rental starts {date} and ends at midnight on {period.end.slice(0, 10)}.</p>}
    {conflict && <p role="alert">This room is unavailable during part of the selected month.</p>}
    {date === today && <p>Choose a future date; rentals begin at midnight.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" onClick={onClose} disabled={submitting} className={styles.secondaryButton}>{cancelLabel}</button>
      <button type="button" className={styles.primaryButton} disabled={!valid || submitting} onClick={confirm}>{submitting ? "Processing…" : confirmLabel}</button></div>
  </section></div>;
}
