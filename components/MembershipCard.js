"use client";

import { useState } from "react";
import styles from "./MembershipCard.module.css";

export default function MembershipCard({ membership, showActions = true }) {
  const [autoRenew, setAutoRenew] = useState(Boolean(membership?.autoRenew));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const toggleAutoRenew = async (enable) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/membership/toggle-auto-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableAutoRenew: enable }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update auto-renewal.");
      }

      setAutoRenew(data.autoRenew);
      setNotice(data.message);
    } catch (err) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRenewToggle = () => {
    toggleAutoRenew(!autoRenew);
  };

  const handleCancelMembership = () => {
    if (
      confirm(
        `Are you sure you want to cancel auto-renewal? Your membership will remain active through ${membership.nextBillingDate || "the end of your billing cycle"}, but will not renew automatically.`
      )
    ) {
      toggleAutoRenew(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{membership.planName}</h2>
            <p className={styles.cardSubtitle}>
              {membership.isDayPass
                ? "Active Today"
                : membership.status === "active" ? "Active plan" : "Inactive plan"}
            </p>
          </div>
          <span className={`${styles.badge} ${membership.status === "active" ? styles.badgeActive : styles.badgeInactive}`}>
            {membership.isDayPass ? "Day Pass" : membership.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>

        <div className={styles.details}>
          {!membership.isDayPass && (
            <div className={styles.detail}>
              <p className={styles.detailLabel}>Monthly Cost</p>
              <p className={styles.detailValue}>
                {membership.monthlyCost != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: membership.currency || "usd" }).format(membership.monthlyCost) : "Unavailable"}
              </p>
            </div>
          )}
          <div className={styles.detail}>
            <p className={styles.detailLabel}>{membership.isDayPass ? "Valid Through" : "Next Billing Date"}</p>
            <p className={styles.detailValue}>{membership.nextBillingDate || "Unavailable"}</p>
          </div>
        </div>

        {showActions && !membership.isDayPass && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.autoRenewBtn}
              onClick={handleAutoRenewToggle}
              disabled={loading}
            >
              {loading ? "Updating..." : autoRenew ? "Disable Auto-Renew" : "Enable Auto-Renew"}
            </button>
            {autoRenew && (
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelMembership}
                disabled={loading}
              >
                Cancel Membership
              </button>
            )}
          </div>
        )}

        {notice && (
          <div className={`${styles.noticeBanner} ${styles.noticeSuccess}`}>
            {notice}
          </div>
        )}

        {error && (
          <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
