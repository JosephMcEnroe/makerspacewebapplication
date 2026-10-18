import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

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
  return <main style={{ padding: "3rem", maxWidth: 720, margin: "auto" }}>
    <h1>Reservation checkout</h1>
    {error ? <p role="alert">{error}</p> : <p role="status">{result?.status === "confirmed" ? "Payment received. Your reservation is confirmed." : result?.status === "expired" ? "Checkout expired. No reservation was created." : result?.status === "unpaid" ? "Payment has not completed. Your reservation is not confirmed." : "Your payment is being processed. Reservation confirmation may take a moment."}</p>}
    {result?.checkoutUrl && <p><a href={result.checkoutUrl}>Continue payment</a></p>}
    {result?.status !== "confirmed" && <button onClick={() => setRetry(n => n + 1)}>Refresh status</button>}
    <p><Link href={{ pathname: "/reservations", query: result ? { type: result.type, reservationId: result.reservationIds } : {} }}>View reservations</Link></p>
  </main>;
}
