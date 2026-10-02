import Head from "next/head";
import ResourceCard from "./ResourceCard";
import styles from "./ExplorePage.module.css";

/**
 * Shared "explore" page for a resource type (rooms / classes / equipment).
 * Shows everything available to book, plus items that are booked
 * indefinitely and currently unavailable for reservation.
 */
export default function ExplorePage({
  title,
  intro,
  bookingWindow,
  items,
}) {
  const available = items.filter((item) => !item.unavailable);
  const unavailable = items.filter((item) => item.unavailable);

  return (
    <div className={styles.page}>
      <Head>
        <title>{title} - The Crafty Studio</title>
        <meta name="description" content={intro} />
      </Head>

      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.bookingWindow}>{bookingWindow}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Available for Reservation</h2>
        {available.length > 0 ? (
          <>
            <div className={styles.grid}>
              {available.map((item) => (
                <ResourceCard key={item.id ?? item.name} {...item} />
              ))}
            </div>
            <p className={styles.countNote}>
              {available.length} {available.length === 1 ? "option" : "options"} open for booking
            </p>
          </>
        ) : (
          <p className={styles.emptyText}>Nothing available right now — check back soon.</p>
        )}
      </section>

      {unavailable.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Currently Unavailable{" "}
            <span className={styles.sectionHint}>
              (booked for the month indefinitely)
            </span>
          </h2>
          <div className={styles.grid}>
            {unavailable.map((item) => (
              <ResourceCard key={item.id ?? item.name} {...item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
