import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import styles from "@/styles/ReservationCheckoutReturn.module.css";


export default function ReservationCheckoutReturn() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!router.isReady) return;
    let canceled = false;
    let timer;
    let attempts = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/reservations/checkout-status?session_id=${encodeURIComponent(router.query.session_id || "")}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (canceled) return;
        setResult(data); setError("");
        if (data.status === "processing" && ++attempts < 20) timer = setTimeout(poll, 3000);
      } catch (err) { if (!canceled) setError(err.message || "Could not load reservation status."); }
    }
    poll();
    return () => { canceled = true; clearTimeout(timer); };
  }, [router.isReady, router.query.session_id, retry]);
  const confirmed = !error && result?.status === "confirmed";
  const title = error ? "Unable to check reservation" : confirmed ? "You're booked!" : result?.status === "expired" ? "Checkout expired" : result?.status === "unpaid" ? "Complete your payment" : "Confirming your reservation";
  return <main className={styles.page}>
    <Head><title>{title} | The Crafty Studio</title></Head>
    <section className={styles.card} aria-labelledby="checkout-title">
      <div className={`${styles.icon} ${confirmed ? styles.confirmed : ""}`} aria-hidden="true">
        {confirmed ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : <span>!</span>}
      </div>
      <p className={styles.eyebrow}>Reservation checkout</p>
      <h1 id="checkout-title" className={styles.title}>{title}</h1>
      {error ? <p className={styles.message} role="alert">{error}</p> : <p className={styles.message} role="status">{confirmed ? "Payment received. Your reservation is confirmed and ready to view." : result?.status === "expired" ? "Checkout expired. No reservation was created." : result?.status === "unpaid" ? "Payment has not completed. Your reservation is not confirmed." : "Your payment is being processed. Reservation confirmation may take a moment."}</p>}
      <div className={styles.actions}>
        {result?.checkoutUrl && <a className={styles.secondaryButton} href={result.checkoutUrl}>Continue payment</a>}
        <Link className={styles.primaryButton} href={{ pathname: "/reservations", query: result ? { type: result.type, reservationId: result.reservationIds } : {} }}>View reservations <span aria-hidden="true">→</span></Link>
        {!confirmed && <button type="button" className={styles.secondaryButton} onClick={() => setRetry(n => n + 1)}>Refresh status</button>}
      </div>
      {confirmed && <>
        {result.type === "equipment" && result.reservationTimes?.length > 0 && (
          <ul className={styles.note}>
            {result.reservationTimes.map((period, index) => (
              <li key={`${period.start}-${index}`}>
                Machine reservation: {period.time} (15 minutes reserved at the end for staff cleanup).
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>You can review your booked times and manage your reservations from your account.</p>
      </>}
    </section>
  </main>;
}
