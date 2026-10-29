import { useEffect, useRef, useState } from "react";
import styles from "@/styles/Reports.module.css";

export default function FinancialReportModal({ onClose }) {
  const dialogRef = useRef(null);
  const requestRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      requestRef.current?.abort();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const [preset, setPreset] = useState("month_to_date");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function download(event) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const params = new URLSearchParams(preset === "custom" ? { start, end } : { preset });
      const controller = new AbortController();
      requestRef.current = controller;
      const response = await fetch(`/api/reports/financial?${params}`, { signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Report download failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "financial-report.pdf";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (error.name !== "AbortError") setError(error.message || "Unable to download report."); }
    finally { setLoading(false); }
  }
  return <dialog ref={dialogRef} className={styles.modal} aria-labelledby="report-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className={styles.main}>
      <div className={styles.header}>
        <h2 id="report-title">Financial reports</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close financial reports">&times;</button>
      </div>
      <p>Download membership, studio, and machine sales with revenue excluding tax, Stripe fees, and refunds.</p>
      <form className={styles.card} onSubmit={download} aria-busy={loading}>
        <label htmlFor="period">Period</label>
        <select id="period" value={preset} onChange={e => setPreset(e.target.value)} disabled={loading}>
          <option value="today">Today</option><option value="week_to_date">Week to date</option>
          <option value="month_to_date">Month to date</option><option value="last_7_days">Last 7 days</option>
          <option value="previous_month">Previous month</option><option value="custom">Custom range</option>
        </select>
        {preset === "custom" && <div className={styles.dates}>
          <label>Start date<input type="date" required value={start} onChange={e => setStart(e.target.value)} disabled={loading} /></label>
          <label>End date<input type="date" required min={start || undefined} value={end} onChange={e => setEnd(e.target.value)} disabled={loading} /></label>
        </div>}
        <p className={styles.note}>All dates use Eastern time. Weeks run Sunday through Saturday. Custom ranges include both dates, up to the current time, and may span up to 366 days.</p>
        <button type="submit" disabled={loading}>{loading ? "Generating PDF..." : "Download PDF"}</button>
        <p role="status" aria-live="polite">{loading ? "Retrieving financial activity and preparing your download. This may take a moment." : ""}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </form>
      <p className={styles.note}>Reports use payment activity dates. Purchased hours and months may relate to future reservations. Net activity does not represent business profit.</p>
    </div>
  </dialog>;
}
