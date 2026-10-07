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

function ReservationCard({ reservation, editable, showDelete, onCancel, onDelete, onEdit }) {
  const handleEdit = () => {
    // Future: open edit flow via API
    console.log("Edit reservation:", reservation.id);
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
          onClick={() => reservation.canEdit ? onEdit(reservation) : handleEdit()}
          disabled={!editable || reservation.canEdit === false}
        >
          Edit
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => onCancel(reservation)}
          disabled={!editable || reservation.canCancel === false}
        >
          Cancel
        </button>
        {showDelete && reservation.canDelete && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => onDelete(reservation)}
          >
            Delete
          </button>
        )}
      </div>
      {reservation.trainingRequired && (
        <span className={styles.trainingBadge}>Training Required</span>
      )}
    </div>
  );
}

export default function ReservationsPanel({ reservations, onCancelReservation, onDeleteCancelledReservation, onEditReservation }) {
  const [activeType, setActiveType] = useState("class");
  const [pendingAction, setPendingAction] = useState(null);
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
                  showDelete={section.key === "cancelled"}
                  onCancel={(reservation) => setPendingAction({ type: "cancel", reservation })}
                  onDelete={(reservation) => setPendingAction({ type: "delete", reservation })}
                  onEdit={onEditReservation}
                />
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>No reservations to show.</p>
          )}
        </div>
      ))}

      {pendingAction && (
        <div
          className={styles.confirmationBackdrop}
          onClick={() => setPendingAction(null)}
        >
          <section
            className={styles.confirmationCard}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reservation-confirm-title"
            aria-describedby="reservation-confirm-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reservation-confirm-title" className={styles.confirmationTitle}>
              {pendingAction.type === "delete" ? "Delete this cancelled reservation?" : "Cancel this reservation?"}
            </h2>
            <p id="reservation-confirm-description" className={styles.confirmationText}>
              {pendingAction.reservation.name} — {pendingAction.reservation.time}
              {pendingAction.type === "delete" && " This cannot be undone."}
            </p>
            <div className={styles.confirmationActions}>
              <button
                type="button"
                className={styles.keepReservationBtn}
                onClick={() => setPendingAction(null)}
              >
                {pendingAction.type === "delete" ? "Keep Cancelled Reservation" : "Keep Reservation"}
              </button>
              <button
                type="button"
                className={pendingAction.type === "delete" ? styles.confirmDeleteBtn : styles.confirmCancelBtn}
                onClick={() => {
                  if (pendingAction.type === "delete") {
                    onDeleteCancelledReservation?.(pendingAction.reservation);
                  } else {
                    onCancelReservation?.(pendingAction.reservation);
                  }
                  setPendingAction(null);
                }}
              >
                {pendingAction.type === "delete" ? "Yes, Delete Reservation" : "Yes, Cancel Reservation"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
