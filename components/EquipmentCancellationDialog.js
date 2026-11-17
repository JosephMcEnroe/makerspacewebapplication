import { useEffect, useRef, useState } from "react";
import { formatTimeRange } from "@/lib/format";
import styles from "./ReservationsPanel.module.css";

export default function EquipmentCancellationDialog({ endpoint, bookingId, memberId, name, time, onClose, onComplete }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);

  async function request(body) {
    const csrf = await fetch("/api/auth/csrf");
    const token = await csrf.json();
    if (!csrf.ok || !token.csrfToken) throw new Error("Could not verify this cancellation.");
    const response = await fetch(endpoint, { method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": token.csrfToken },
      body: JSON.stringify({ type: "equipment", reservationId: bookingId, userId: memberId, ...body }) });
    return { response, result: await response.json() };
  }

  useEffect(() => {
    let active = true;
    const element = dialog.current;
    if (!element.open) element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    request({ preview: true }).then(({ response, result }) => {
      if (!active) return;
      if (!response.ok) throw new Error(result.error || "Could not calculate refund.");
      if (result.cancelled) { onComplete(); return; }
      setPreview(result.preview);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; document.body.style.overflow = previousOverflow; element.close(); };
    // Dialog mounts for exactly one reservation; changing callbacks must not reset its quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm() {
    setBusy(true); setError("");
    try {
      const { response, result } = await request({ quote: preview.quote });
      if (response.status === 409 && result.preview) {
        setPreview(result.preview); setError(result.error); return;
      }
      if (!response.ok) throw new Error(result.error || "Could not cancel reservation.");
      onComplete();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className={styles.confirmDialog} aria-labelledby="equipment-cancel-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.dialogHeader}>
      <div><span className={styles.dialogEyebrow}>Reservation cancellation</span>
        <h2 id="equipment-cancel-title">Cancel this reservation?</h2></div>
      <button type="button" className={styles.dialogClose} aria-label="Close cancellation" disabled={busy} onClick={onClose}>×</button>
    </header>
    <div className={styles.dialogBody}>
      <div className={styles.bookingSummary}><strong>{name}</strong><span>{time}</span></div>
      {!preview && !error && <p role="status">Calculating your refund…</p>}
      {preview && <>
        <div className={styles.refundSummary}>
          <div><span>Refund to original payment</span><strong>${preview.refundAmount}</strong></div>
          <div><span>Non-refundable amount</span><strong>${preview.forfeitedAmount}</strong></div>
        </div>
        <p>{preview.reason}</p>
        <details className={styles.hourBreakdown}>
          <summary>View hour-by-hour breakdown ({preview.hours.length})</summary>
          <ul>{preview.hours.map(hour => <li key={hour.start}>
            <span>{formatTimeRange(hour.start, hour.end)}<small>{hour.refundable ? "Refundable" : "No refund"}</small></span>
            <strong>${hour.amount}</strong>
          </li>)}</ul>
          {!preview.hours.length && <p>No unstarted hours remain. No refund will be issued.</p>}
        </details>
        <p className={styles.releaseNote}>All remaining hours on this reservation will be released. Other reservations stay booked.</p>
      </>}
      {error && <p className={styles.dialogError} role="alert">{error}</p>}
    </div>
    <footer className={styles.dialogFooter}>
      <button type="button" className={styles.editBtn} disabled={busy} onClick={onClose}>Keep reservation</button>
      <button type="button" className={styles.cancelBtn} disabled={!preview || busy} onClick={confirm}>
        {busy ? "Cancelling…" : preview?.refundAmount === "0.00" ? "Cancel with no refund" : "Confirm cancellation"}
      </button>
    </footer>
  </dialog>;
}
