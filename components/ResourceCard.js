import { useState } from "react";
import { DEFAULT_RESOURCE_IMAGE } from "@/lib/resourceImages";
import styles from "./ResourceCard.module.css";

function ResourceImage({ image, name }) {
  const [source, setSource] = useState(image);

  if (!source) {
    return (
      <svg aria-hidden="true" className={styles.placeholderIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    );
  }

  return (
    // Native images preserve the local files without requiring an optimization server.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt={source === DEFAULT_RESOURCE_IMAGE ? "Collaboratory logo" : name}
      loading="lazy"
      className={source === DEFAULT_RESOURCE_IMAGE ? `${styles.resourceImage} ${styles.logoImage}` : styles.resourceImage}
      onError={() => setSource(source === DEFAULT_RESOURCE_IMAGE ? null : DEFAULT_RESOURCE_IMAGE)}
    />
  );
}

export default function ResourceCard({ name, image, description, time, spots, unavailable, unavailableNote }) {
  const source = image || DEFAULT_RESOURCE_IMAGE;
  return (
    <div className={unavailable ? `${styles.card} ${styles.cardUnavailable}` : styles.card}>
      <div className={styles.imagePlaceholder}>
        <ResourceImage key={source} image={source} name={name} />
        {(time || spots) && (
          <div className={styles.badgeRow}>
            {time && <span className={styles.timeBadge}>{time}</span>}
            {spots && <span className={styles.spotsBadge}>{spots}</span>}
          </div>
        )}
        {unavailable && (
          <div className={styles.unavailableBadge}>Booked Indefinitely</div>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{name}</h3>
        <p className={styles.description}>{description}</p>
        {unavailable && (
          <p className={styles.unavailableNote}>
            {unavailableNote || "Currently unavailable for reservation."}
          </p>
        )}
      </div>
    </div>
  );
}
