"use client";

import { useState } from "react";
import styles from "./ReservationsPanel.module.css";

const TABS = [
  { key: "equipment", label: "Equipment Reservations" },
  { key: "class", label: "Class Reservations" },
];

const SECTIONS = [
  { key: "upcoming", label: "Upcoming Reservations" },
  { key: "previous", label: "Previous Reservations" },
  { key: "cancelled", label: "Cancelled Reservations" },
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
      {reservation.trainingRequired && <span className={styles.trainingBadge}>Training Required</span>}
      <p className={styles.cardName}>{reservation.name}</p>
      <p className={styles.cardTime}>{reservation.time}</p>
      <div className={styles.cardActions}>
        <button type="button" className={styles.editBtn} onClick={handleEdit} disabled={!editable}>
          Edit
        </button>
        <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={!editable}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ReservationsPanel({ reservations }) {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const activeReservations = reservations[activeTab];

  return (
    <div>
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {SECTIONS.map((section) => (
        <div key={section.key} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.label}</h2>
          {activeReservations[section.key].length > 0 ? (
            <div className={styles.cardGrid}>
              {activeReservations[section.key].map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  editable={section.key === "upcoming"}
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
