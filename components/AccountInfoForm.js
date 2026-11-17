"use client";

import { useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./AccountInfoForm.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// U.S. phone format as the user types: 555-555-5555
function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Server props use camelCase; keep one place that maps them into form values
function toFormValues(source) {
  return {
    firstName: source.firstName ?? "",
    lastName: source.lastName ?? "",
    dateOfBirth: source.dateOfBirth ?? "",
    email: source.email ?? "",
    phoneNumber: formatPhoneNumber(source.phoneNumber),
  };
}

export default function AccountInfoForm({ account }) {
  // `savedValues` is what the database currently holds, so we can tell whether
  // the user actually edited something
  const [savedValues, setSavedValues] = useState(() => toFormValues(account));
  const [formData, setFormData] = useState(() => toFormValues(account));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [emailTouched, setEmailTouched] = useState(false);
  // Keeps the name in the sidebar/header in sync with what was just saved
  const { setUser } = useAuthContext();

  const isDirty = Object.keys(savedValues).some(
    (field) => formData[field] !== savedValues[field]
  );

  // Warn as soon as the email has been edited and isn't a valid address
  const emailError = EMAIL_PATTERN.test(formData.email.trim())
    ? null
    : formData.email.trim()
      ? "That doesn't look like an email address. Use the format name@example.com."
      : "Enter your email address.";
  const showEmailError = Boolean(emailError && emailTouched);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "phoneNumber" ? formatPhoneNumber(value) : value;
    if (name === "email") setEmailTouched(true);
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isDirty || saving) return;

    setSaving(true);
    setStatus(null);

    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = await csrfResponse.json();

      const response = await fetch("/api/account/profile", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save your changes.");
      }

      const saved = toFormValues(data.account ?? formData);
      setSavedValues(saved);
      setFormData(saved);
      setUser((prev) =>
        prev ? { ...prev, firstName: saved.firstName, lastName: saved.lastName } : prev
      );
      setStatus({ type: "success", message: "Your account information has been updated." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Could not save your changes." });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = () => {
    // Future: trigger password reset flow
    console.log("Reset password requested");
  };

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <h2 className={styles.cardTitle}>Personal Information</h2>

      <div className={styles.row}>
        <div className={styles.formGroup}>
          <label htmlFor="firstName" className={styles.label}>
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            className={styles.input}
            value={formData.firstName}
            onChange={handleChange}
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
            className={styles.input}
            value={formData.lastName}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="dateOfBirth" className={styles.label}>
            Date of Birth
          </label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            className={styles.input}
            value={formData.dateOfBirth}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={`${styles.formGroup} ${styles.grow}`}>
          <label htmlFor="email" className={styles.label}>
            E-mail Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={`${styles.input} ${showEmailError ? styles.inputInvalid : ""}`}
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            aria-invalid={showEmailError || undefined}
            aria-describedby={showEmailError ? "emailError" : undefined}
          />
          {showEmailError && (
            <p className={styles.fieldError} id="emailError" role="alert">
              {emailError}
            </p>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="phoneNumber" className={styles.label}>
            Phone Number
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            className={styles.input}
            value={formData.phoneNumber}
            onChange={handleChange}
            autoComplete="tel"
            placeholder="555-555-5555"
            maxLength={12}
          />
        </div>
      </div>

      {status && (
        <p
          className={status.type === "error" ? styles.statusError : styles.statusSuccess}
          role="status"
        >
          {status.message}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.resetBtn} onClick={handleResetPassword}>
          Reset Password
        </button>
        <button type="submit" className={styles.saveBtn} disabled={!isDirty || saving || Boolean(emailError)}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
