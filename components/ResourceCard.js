import styles from "./ResourceCard.module.css";

export default function ResourceCard({ name, description, time, spots }) {
  return (
    <div className={styles.card}>
      <div className={styles.imagePlaceholder}>
        {(time || spots) && (
          <div className={styles.badgeRow}>
            {time && <span className={styles.timeBadge}>{time}</span>}
            {spots && <span className={styles.spotsBadge}>{spots}</span>}
          </div>
        )}
        <svg className={styles.placeholderIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{name}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </div>
  );
}
