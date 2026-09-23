import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";

export default function CheckoutReturnPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [status, setStatus] = useState(null);
  const [customerEmail, setCustomerEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session_id) return;

    fetch(`/api/session-status?session_id=${session_id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to retrieve session status");
        }
        setStatus(data.status);
        setCustomerEmail(data.customer_email);
      })
      .catch((err) => {
        console.error("Error checking session:", err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session_id]);

  if (loading) {
    return (
      <div style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
        <h2>Verifying your payment...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "600px", margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h1>Unable to Verify Payment</h1>
        <p style={{ color: "#d32f2f", marginBottom: "2rem" }}>{error}</p>
        <Link
          href="/checkout"
          style={{
            display: "inline-block",
            backgroundColor: "#1976d2",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
          }}
        >
          Return to Checkout
        </Link>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <>
        <Head>
          <title>Payment Successful - The Crafty Studio</title>
        </Head>
        <div
          style={{
            maxWidth: "600px",
            margin: "4rem auto",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <h1 style={{ marginBottom: "0.5rem" }}>Payment Successful!</h1>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>
            Thank you for joining The Crafty Studio.
            {customerEmail && (
              <> A confirmation receipt has been sent to <strong>{customerEmail}</strong>.</>
            )}
          </p>
          {session_id && (
            <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "2rem" }}>
              Session ID: {session_id}
            </p>
          )}
          <Link
            href="/membership"
            style={{
              display: "inline-block",
              backgroundColor: "#2e7d32",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            View Your Membership
          </Link>
        </div>
      </>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
      <h1>Payment Pending</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Your payment is currently being processed. If you haven&apos;t finished paying, you can return to checkout.
      </p>
      <Link
        href="/checkout"
        style={{
          display: "inline-block",
          backgroundColor: "#1976d2",
          color: "#fff",
          padding: "0.75rem 1.5rem",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        Return to Checkout
      </Link>
    </div>
  );
}
