import { useEffect } from "react";
import Link from "next/link";
import styles from "./WaiverRequiredDialog.module.css";

export default function MembershipRequiredDialog({ onClose }) {
  useEffect(() => {
    const keyDown = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [onClose]);
  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="membership-required-title">
      <h2 id="membership-required-title" className={styles.title}>Membership required</h2>
      <p className={styles.text}>An active membership or valid day pass is required to make or change reservations.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>Keep Browsing</button>
        <Link href="/membership" className={styles.primary}>View Memberships</Link>
      </div>
    </section>
  </div>;
}
