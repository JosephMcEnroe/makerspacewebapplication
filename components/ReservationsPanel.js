"use client";

import styles from "./ReservationsPanel.module.css";

const SECTIONS = [
  { key: "upcoming", label: "Upcoming Reservations", editable: true },
  { key: "previous", label: "Previous Reservations", editable: false },
  { key: "cancelled", label: "Cancelled Reservations", editable: false },
];

function ReservationCard({ reservation, editable }) {
  const handleEdit = () => {
    // Future: open edit flow via API
    console.log("Edit reservation:", reservation.id);
  };

  const handleCancel = () => {
    // Future: cancel reservation via API
    console.log("Cancel reservation:", reservation.id);
  };

  return (
    <div className={styles.card}>
      {reservation.trainingRequired && (
        <span className={styles.trainingBadge}>Training Required</span>
      )}
      <div className={styles.cardHeader}>
        <p className={styles.cardName}>{reservation.name}</p>
        <p className={styles.cardTime}>{reservation.time}</p>
      </div>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleEdit}
          disabled={!editable}
        >
          Edit
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={!editable}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ReservationsPanel({ reservations }) {
  // Display equipment reservations directly (no tab UI as per design)
  const data = reservations.equipment;

  return (
    <div>
      {SECTIONS.map((section) => (
        <div key={section.key} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.label}</h2>
          {data[section.key].length > 0 ? (
            <div className={styles.cardGrid}>
              {data[section.key].map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  editable={section.editable}
                />
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>No reservations to show.</p>
          )}
        </div>
      ))}
    </div>
  );
}
