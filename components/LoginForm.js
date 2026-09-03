"use client";

import Link from "next/link";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>WELCOME BACK</h1>
      <p className={styles.subtitle}>Sign in to your Crafty Studio account</p>

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

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Enter your password"
            className={styles.input}
            autoComplete="current-password"
          />
        </div>

        <div className={styles.optionsRow}>
          <label className={styles.rememberMe}>
            <input type="checkbox" name="rememberMe" className={styles.checkbox} />
            <span>Remember me</span>
          </label>

          <Link href="/forgot-password" className={styles.forgotPassword}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" className={styles.submitBtn}>
          Sign In
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerText}>OR</span>
        </div>

        <Link href="/register" className={styles.createAccountBtn}>
          Create New Account
        </Link>
      </form>
    </div>
  );
}

