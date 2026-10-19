import styles from "@/styles/StaffPages.module.css";

export default function MembershipStatusBadge({ status }) {
  if (!status) return <span className={`${styles.badge} ${styles.badgeNone}`}>No membership</span>;
  const className = status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive;
  return <span className={`${styles.badge} ${className}`}>{status.toLowerCase()}</span>;
}
