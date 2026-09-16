"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./RegisterForm.module.css";

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Future: submit registration via API
    console.log("Register:", formData);
  };

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>CREATE ACCOUNT</h1>
      <p className={styles.subtitle}>Join The Crafty Studio community</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label htmlFor="firstName" className={styles.label}>
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Jane"
              className={styles.input}
              value={formData.firstName}
              onChange={handleChange}
              autoComplete="given-name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lastName" className={styles.label}>
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Doe"
              className={styles.input}
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="your.email@example.com"
            className={styles.input}
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Create a password"
            className={styles.input}
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            className={styles.input}
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className={styles.submitBtn}>
          Create Account
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerText}>OR</span>
        </div>

        <Link href="/login" className={styles.signInBtn}>
          Sign In Instead
        </Link>
      </form>
    </div>
  );
}

