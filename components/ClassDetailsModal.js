import { useEffect, useState } from "react";
import { DEFAULT_RESOURCE_IMAGE } from "@/lib/resourceImages";
import styles from "./ClassDetailsModal.module.css";

// Class popup: details, date/time and a "Reserve A Spot" button
export default function ClassDetailsModal({ classItem, onClose, onReserve }) {
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");
  const { name, description, image, dateLabel, timeLabel, instructor, enrolled, capacity } = classItem;
  const full = capacity != null && enrolled >= capacity;
  const spotsLeft = capacity != null ? Math.max(capacity - enrolled, 0) : null;
  const isLogo = !image || image === DEFAULT_RESOURCE_IMAGE;

  useEffect(() => {
    const handleKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleReserve = async () => {
    setReserving(true);
    setError("");
    try {
      await onReserve();
    } catch (err) {
      setError(err.message || "Could not reserve this class.");
      setReserving(false);
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="class-details-title">
        <div className={`${styles.hero} ${isLogo ? styles.heroLogo : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image || DEFAULT_RESOURCE_IMAGE} alt="" className={styles.heroImage} />
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close class details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.main}>
            <div className={styles.titleRow}>
              <h2 id="class-details-title" className={styles.title}>{name}</h2>
              {capacity != null && (
                <span className={styles.capacityPill} aria-label={`${enrolled} of ${capacity} spots taken`}>
                  {enrolled}/{capacity}
                </span>
              )}
            </div>
            {description && <p className={styles.description}>{description}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="button" className={styles.reserveButton} onClick={handleReserve} disabled={reserving || full}>
              {full ? "Class Full" : reserving ? "Reserving…" : "Reserve A Spot"}
            </button>
          </div>

          <aside className={styles.side}>
            {(timeLabel || dateLabel) && (
              <div className={styles.dateCard}>
                {timeLabel && <p className={styles.time}>{timeLabel}</p>}
                {dateLabel && <p className={styles.date}>{dateLabel}</p>}
              </div>
            )}
            <div className={styles.detailsCard}>
              <h3 className={styles.detailsTitle}>Class Details</h3>
              <dl className={styles.detailsList}>
                {instructor && (
                  <div className={styles.detailsRow}>
                    <dt>Instructor:</dt>
                    <dd>{instructor}</dd>
                  </div>
                )}
                {spotsLeft != null && (
                  <div className={styles.detailsRow}>
                    <dt>Spots Left:</dt>
                    <dd>{spotsLeft}</dd>
                  </div>
                )}
                <div className={styles.detailsRow}>
                  <dt>Availability:</dt>
                  <dd className={full ? styles.full : styles.available}>{full ? "Full" : "Available"}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
