"use client";

import { useState } from "react";
import styles from "./ReservationsPanel.module.css";

const TYPES = [
  { key: "class", label: "Class Reservations" },
  { key: "room", label: "Room Reservations" },
  { key: "equipment", label: "Equipment Reservations" },
];

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
      {reservation.trainingRequired && (
        <span className={styles.trainingBadge}>Training Required</span>
      )}
    </div>
  );
}

export default function ReservationsPanel({ reservations }) {
  const [activeType, setActiveType] = useState("class");
  const active = TYPES.find((type) => type.key === activeType);
  const data = reservations[active.key] || {
    upcoming: [],
    previous: [],
    cancelled: [],
  };

  return (
    <div>
      <div className={styles.typeToggle} role="tablist" aria-label="Reservation type">
        {TYPES.map((type) => (
          <button
            key={type.key}
            type="button"
            role="tab"
            aria-selected={activeType === type.key}
            className={
              activeType === type.key
                ? `${styles.typeTab} ${styles.typeTabActive}`
                : styles.typeTab
            }
            onClick={() => setActiveType(type.key)}
          >
            {type.label}
          </button>
        ))}
      </div>

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
