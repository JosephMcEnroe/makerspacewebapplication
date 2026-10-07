import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import ResourceCard from "./ResourceCard";
import WeeklyAvailability from "./WeeklyAvailability";
import styles from "./ExplorePage.module.css";

/**
 * Shared "explore" page for a resource type (rooms / classes / equipment).
 * Shows everything available to book, plus items that are booked
 * indefinitely and currently unavailable for reservation.
 */
export default function ExplorePage({
  title,
  type, // "rooms" | "classes" | "equipment" — used to build card links
  intro,
  bookingWindow,
  items,
}) {
  const router = useRouter();
  const [selectedResourceOverride, setSelectedResourceOverride] = useState(null);
  const [selectedSlotsOverride, setSelectedSlotsOverride] = useState(null);
  const [editIdsOverride, setEditIdsOverride] = useState(null);
  const available = items.filter((item) => !item.unavailable);
  const unavailable = items.filter((item) => item.unavailable);
  const queryResourceId = router.isReady && typeof router.query.resource === "string"
    ? router.query.resource
    : null;
  const queryResource = items.find((item) => item.id === queryResourceId) || null;
  const selectedResource = selectedResourceOverride || queryResource;
  const querySlots = Array.isArray(router.query.slots)
    ? router.query.slots[0]
    : router.query.slots;
  const queryEditIds = Array.isArray(router.query.editIds)
    ? router.query.editIds[0]
    : router.query.editIds;
  const selectedSlots = selectedSlotsOverride ?? (() => {
    try {
      const parsed = JSON.parse(querySlots || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const editIds = editIdsOverride ?? (() => {
    try {
      const parsed = JSON.parse(queryEditIds || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const closeAvailability = useCallback(() => {
    setSelectedResourceOverride(null);
    setSelectedSlotsOverride(null);
    setEditIdsOverride(null);
    if (queryResourceId) {
      router.replace({ pathname: router.pathname }, undefined, { shallow: true });
    }
  }, [queryResourceId, router]);

  useEffect(() => {
    if (!selectedResource) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeAvailability();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedResource, closeAvailability]);

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
                <button
                  key={item.id || item.name}
                  type="button"
                  className={styles.cardButton}
                  onClick={() => {
                    setSelectedResourceOverride(item);
                    setSelectedSlotsOverride([]);
                    setEditIdsOverride([]);
                  }}
                  aria-label={`View availability for ${item.name}`}
                >
                  <ResourceCard {...item} />
                </button>
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
              <button
                key={item.id || item.name}
                type="button"
                className={styles.cardButton}
                onClick={() => {
                  setSelectedResourceOverride(item);
                  setSelectedSlotsOverride([]);
                  setEditIdsOverride([]);
                }}
                aria-label={`View availability for ${item.name}`}
              >
                <ResourceCard {...item} />
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedResource && (
        <div
          className={styles.modalBackdrop}
          onClick={closeAvailability}
        >
          <section
            className={styles.availabilityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeAvailability}
              aria-label="Close availability"
            >
              ×
            </button>
            <h2 id="availability-modal-title" className={styles.modalTitle}>
              {selectedResource.name} Availability
            </h2>
            <p className={styles.modalDescription}>{selectedResource.description}</p>
            <WeeklyAvailability
              type={type}
              typeLabel={`${title}: ${selectedResource.name}`}
              selectable={!selectedResource.unavailable}
              selectedSlots={selectedSlots}
              allowSelectedUnavailable={editIds.length > 0}
              onToggleSlot={(slot) => {
                const key = `${slot.date}:${slot.start}`;
                setSelectedSlotsOverride((current) =>
                  current.some((entry) => `${entry.date}:${entry.start}` === key)
                    ? current.filter((entry) => `${entry.date}:${entry.start}` !== key)
                    : [...current, slot].sort(
                        (a, b) => `${a.date}:${a.start}`.localeCompare(`${b.date}:${b.start}`)
                      )
                );
              }}
            />
            {!selectedResource.unavailable && (
              <p className={styles.selectedSlotSummary} aria-live="polite">
                {selectedSlots.length === 0
                  ? "No times selected yet. Select one or more green times to continue."
                  : `${selectedSlots.length} ${selectedSlots.length === 1 ? "time" : "times"} selected.`}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalSecondary}
                onClick={closeAvailability}
              >
                Close
              </button>
              {selectedResource.unavailable ? (
                <Link
                  href={`/reserve/${type}/${selectedResource.id || selectedResource.name}`}
                  className={styles.modalPrimary}
                >
                  View reservation details
                </Link>
              ) : (
                <Link
                  href={`/reserve/${type}/${selectedResource.id || selectedResource.name}?slots=${encodeURIComponent(JSON.stringify(selectedSlots))}&editIds=${encodeURIComponent(JSON.stringify(editIds))}&originalResourceId=${encodeURIComponent(typeof router.query.originalResourceId === "string" ? router.query.originalResourceId : selectedResource.id || selectedResource.name)}`}
                  className={`${styles.modalPrimary} ${selectedSlots.length === 0 ? styles.modalPrimaryDisabled : ""}`}
                  aria-disabled={selectedSlots.length === 0}
                  onClick={(event) => {
                    if (selectedSlots.length === 0) event.preventDefault();
                  }}
                >
                  {editIds.length > 0 ? "Save Changes" : `Continue with ${selectedSlots.length > 0 ? `${selectedSlots.length} selected ${selectedSlots.length === 1 ? "time" : "times"}` : "selected times"}`}
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
