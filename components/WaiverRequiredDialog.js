import { useEffect } from "react";
import Link from "next/link";
import styles from "./WaiverRequiredDialog.module.css";

// Shown instead of the booking screen when the user hasn't signed their waiver
export default function WaiverRequiredDialog({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="waiver-required-title">
        <h2 id="waiver-required-title" className={styles.title}>Sign your waiver first</h2>
        <p className={styles.text}>
          You need to complete the liability waiver before making a reservation. It only takes a minute.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>Not Now</button>
          <Link href="/account#waiver" className={styles.primary}>Sign Waiver</Link>
        </div>
      </section>
    </div>
  );
}
