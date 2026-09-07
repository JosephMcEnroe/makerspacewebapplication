"use client";

import { useState } from "react";
import styles from "./AccountInfoForm.module.css";

export default function AccountInfoForm({ account }) {
  const [formData, setFormData] = useState({
    firstName: account.firstName,
    lastName: account.lastName,
    dateOfBirth: account.dateOfBirth,
    email: account.email,
    phoneNumber: account.phoneNumber,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Future: persist changes via API
    console.log("Save changes:", formData);
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
            className={styles.input}
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
          />
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
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.resetBtn} onClick={handleResetPassword}>
          Reset Password
        </button>
        <button type="submit" className={styles.saveBtn}>
          Save Changes
        </button>
      </div>
    </form>
  );
}
