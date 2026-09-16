import {
  CheckoutFormProvider,
  CheckoutForm,
  useCheckoutForm,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import React, { useState, useEffect } from "react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51UG5ykE2d8t9SSuLXgrGI2eNL8pCE70fbLRQvmHnFrzXOwDTgmNJ1cdEtyXEECBQpgSs0LB4hizPFCWSGAn63INQ00GlD0Mbis"
);

function CheckoutFormContent({ onError }) {
  const checkoutState = useCheckoutForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async (event) => {
    if (checkoutState.type !== "success") return;

    setIsSubmitting(true);
    try {
      const result = await checkoutState.checkout.confirm({
        formConfirmEvent: event,
      });

      if (result && result.type === "error") {
        onError(result.error?.message || "Payment confirmation failed.");
      }
    } catch (err) {
      console.error("Confirmation error:", err);
      onError(err.message || "An unexpected error occurred during confirmation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkoutState.type === "error") {
    return (
      <div style={{ color: "#d32f2f", padding: "1rem" }}>
        Failed to initialize checkout: {checkoutState.error?.message}
      </div>
    );
  }

  return (
    <>
      <CheckoutForm
        onLoadError={(event) => {
          console.error("CheckoutForm loaderror:", event.error);
          onError(event.error?.message || "Failed to load payment form");
        }}
        onConfirm={handleComplete}
      />
      {isSubmitting && (
        <div style={{ textAlign: "center", marginTop: "1rem", color: "#666" }}>
          Processing your payment...
        </div>
      )}
    </>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/create-checkout-session", {
      method: "POST",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create checkout session");
        }
        setClientSecret(data.clientSecret);
      })
      .catch((err) => {
        console.error("Checkout session fetch error:", err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "1rem" }}>
      {loading && (
        <div style={{ padding: "2rem", textAlign: "center" }}>Loading checkout...</div>
      )}

      {error && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            color: "#d32f2f",
            backgroundColor: "#ffebee",
            borderRadius: "4px",
            border: "1px solid #ffcdd2",
          }}
        >
          <strong>Error loading checkout:</strong> {error}
        </div>
      )}

      {clientSecret && (
        <CheckoutFormProvider
          stripe={stripePromise}
          options={{ clientSecret }}
        >
          <CheckoutFormContent onError={setError} />
        </CheckoutFormProvider>
      )}
    </div>
  );
}