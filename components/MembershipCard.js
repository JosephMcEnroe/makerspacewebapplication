"use client";

import styles from "./MembershipCard.module.css";

export default function MembershipCard({ membership }) {
  const handleAutoRenewToggle = () => {
    // Future: persist auto-renew preference via API
    console.log("Toggle auto-renew");
  };

  const handleCancelMembership = () => {
    // Future: trigger cancellation flow
    console.log("Cancel membership requested");
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{membership.planName}</h2>
            <p className={styles.cardSubtitle}>{membership.status === "active" ? "Active plan" : "Inactive plan"}</p>
          </div>
          <span className={`${styles.badge} ${membership.status === "active" ? styles.badgeActive : styles.badgeInactive}`}>
            {membership.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>

        <div className={styles.details}>
          <div className={styles.detail}>
            <p className={styles.detailLabel}>Monthly Cost</p>
            <p className={styles.detailValue}>${membership.monthlyCost.toFixed(2)}</p>
          </div>
          <div className={styles.detail}>
            <p className={styles.detailLabel}>Next Billing Date</p>
            <p className={styles.detailValue}>{membership.nextBillingDate}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.autoRenewBtn} onClick={handleAutoRenewToggle}>
            {membership.autoRenew ? "Disable Auto-Renew" : "Enable Auto-Renew"}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={handleCancelMembership}>
            Cancel Membership
          </button>
        </div>
      </div>

      <div className={styles.promoCard}>
        <h3 className={styles.promoTitle}>Why Crafty Studio?</h3>
        <p className={styles.promoText}>
          Experience the power of a supportive creator community that understands your vision. Share your work,
          learn from others, and amplify your impact.
        </p>
      </div>
    </div>
  );
}
