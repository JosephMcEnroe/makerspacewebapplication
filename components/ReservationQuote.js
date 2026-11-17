import { useEffect, useState } from "react";
import styles from "./WeeklyAvailability.module.css";

export default function ReservationQuote({ type, resourceId, periods }) {
  const [responseState, setResponseState] = useState(null);
  const payload = JSON.stringify({ type, resourceId, periods });
  const result = responseState?.payload === payload ? responseState.data : null;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!JSON.parse(payload).periods.length) return () => controller.abort();
    fetch("/api/reservations/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Pricing is unavailable.");
        if (active) setResponseState({ payload, data });
      }).catch(error => { if (active && error.name !== "AbortError") setResponseState({ payload, data: { error: error.message } }); });
    return () => { active = false; controller.abort(); };
  }, [payload]);
  if (!periods.length) return null;
  if (!result) return <p role="status">Calculating price…</p>;
  if (result.error) return <p role="alert">{result.error}</p>;
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: result.currency }).format(cents / 100);
  return <div className={styles.quoteSummary} aria-live="polite">
    {result.label && <div className={styles.quoteDiscount}>
      <span>{result.label}</span>
      <span>{money(-result.discountAmount)}</span>
    </div>}
    <div className={styles.quoteTotal}>
      <span>Total</span>
      <span>{result.discountAmount > 0 && <s className={styles.quoteOriginal}>{money(result.subtotal)}</s>}<strong>{money(result.total)}</strong></span>
    </div>
  </div>;
}
