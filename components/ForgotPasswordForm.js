"use client";

import Link from "next/link";
import styles from "./ForgotPasswordForm.module.css";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function ForgotPasswordForm() {
  const { forgotPassword, loginloading } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const data = await forgotPassword(email);

      setMessage(data.message);
      setEmail("");

    } catch (err) {
      setError(err.message || "Unable to send recovery link.");
    }
  };

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>FORGOT PASSWORD</h1>
      <p className={styles.subtitle}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="your.email@example.com"
            className={styles.input}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loginloading}
          />
        </div>
        {message && (
          <p role="status">{message}</p>
        )}
        {error && (
          <p role="alert">{error}</p>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loginloading}>
          {loginloading ? "Sending..." : "Send Recovery Link"}
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerText}>OR</span>
        </div>

        <Link href="/login" className={styles.backToSignIn}>
          Back to Sign In
        </Link>
      </form>
    </div>
  );
}
