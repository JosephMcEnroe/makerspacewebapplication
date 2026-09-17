"use client";

import Link from "next/link";
import styles from "./ForgotPasswordForm.module.css";

export default function ForgotPasswordForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
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
          />
        </div>

        <button type="submit" className={styles.submitBtn}>
          Send Recovery Link
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
