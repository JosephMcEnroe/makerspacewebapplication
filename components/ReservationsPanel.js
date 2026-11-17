import { useEffect, useMemo, useState } from "react";
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

function ReservationCard({ reservation, editable, highlighted, reservationType, onEdit, onCancel }) {
  return (
    <div id={`reservation-${reservationType}-${reservation.reservationId}`} className={`${styles.card} ${highlighted ? styles.cardHighlighted : ""}`}>
      {highlighted && <span className={styles.newReservationBadge}>Just reserved</span>}
      <div className={styles.cardHeader}>
        <p className={styles.cardName}>{reservation.name}</p>
        <p className={styles.cardTime}>{reservation.time}</p>
        {reservation.refundLabel && <p className={styles.refundBadge} role="status">{reservation.refundLabel}</p>}
        {editable && reservationType === "equipment" && reservation.nonRefundable && <p className={styles.nonRefundable}>Non-refundable reservation</p>}
      </div>
      {editable && <div className={styles.cardActions}>
        {/* Class reservations can only be cancelled, not edited */}
        {reservationType !== "class" && (
          <button type="button" className={styles.editBtn} onClick={() => onEdit(reservation)} disabled={!editable}>Edit</button>
        )}
        <button type="button" className={styles.cancelBtn} onClick={() => onCancel(reservation)} disabled={!editable}>Cancel</button>
      </div>}
      {reservation.trainingRequired && <span className={styles.trainingBadge}>Training Required</span>}
    </div>
  );
}

function HistorySection({ section, rows, renderCard, targetIds }) {
  const pageSize = 6;
  const sorted = [...rows].sort((a, b) => Date.parse(b.cancelledAt || b.startDate) - Date.parse(a.cancelledAt || a.startDate));
  const targetIndex = sorted.findIndex(row => targetIds.has(String(row.reservationId)));
  const [visible, setVisible] = useState(Math.max(pageSize, Math.ceil((targetIndex + 1) / pageSize) * pageSize));
  const attention = rows.filter(row => row.refundLabel && /processing|needs attention/.test(row.refundLabel)).length;
  return <details className={`${styles.section} ${styles.historySection}`} open={targetIndex >= 0 || attention > 0 ? true : undefined}>
    <summary className={styles.historySummary}>
      <h2>{section.label}</h2><span className={styles.historyCount}>{rows.length}</span>
      {attention > 0 && <span className={styles.historyAttention}>{attention} refund{attention === 1 ? "" : "s"} in progress or needing attention</span>}
    </summary>
    <div className={styles.historyBody}>
      {rows.length ? <>
        <div className={styles.cardGrid}>{sorted.slice(0, visible).map(renderCard)}</div>
        <div className={styles.historyPagination}>
          <span>Showing {Math.min(visible, rows.length)} of {rows.length}</span>
          {visible < rows.length && <button type="button" className={styles.editBtn} onClick={() => setVisible(count => count + pageSize)}>Show more</button>}
          {visible > pageSize && <button type="button" className={styles.cancelBtn} onClick={() => setVisible(pageSize)}>Show fewer</button>}
        </div>
      </> : <p className={styles.emptyText}>No reservations to show.</p>}
    </div>
  </details>;
}

export default function ReservationsPanel({ reservations, initialType, initialReservationIds = [], onEdit, onCancel }) {
  const [activeType, setActiveType] = useState(initialType || "class");
  const newReservationIds = useMemo(() => new Set(initialReservationIds.map(String)), [initialReservationIds]);
  const reservationTargetId = initialReservationIds[0];

  useEffect(() => {
    if (!initialType || !reservationTargetId) return;
    const matchingReservation = Object.values(reservations[initialType] || {})
      .flatMap((section) => section)
      .find((reservation) => [reservation.reservationId, ...(reservation.reservationIds || [])]
        .some((id) => String(id) === String(reservationTargetId)));
    const reservationId = matchingReservation?.reservationId ?? reservationTargetId;
    document.getElementById(`reservation-${initialType}-${reservationId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initialType, reservationTargetId, reservations]);
  const active = TYPES.find((type) => type.key === activeType);
  const data = reservations[active.key] || { upcoming: [], previous: [], cancelled: [] };

  return (
    <div>
      <div className={styles.typeToggle} role="tablist" aria-label="Reservation type">
        {TYPES.map((type) => (
          <button key={type.key} type="button" role="tab" aria-selected={activeType === type.key}
            className={activeType === type.key ? `${styles.typeTab} ${styles.typeTabActive}` : styles.typeTab}
            onClick={() => setActiveType(type.key)}>
            {type.label}
          </button>
        ))}
      </div>

      {SECTIONS.map((section) => {
        const renderCard = reservation => <ReservationCard
          key={reservation.id} reservation={reservation} reservationType={active.key}
          editable={section.editable} highlighted={newReservationIds.has(String(reservation.reservationId))}
          onEdit={value => onEdit(active.key, value)} onCancel={value => onCancel(active.key, value)} />;
        if (!section.editable) return <HistorySection key={`${active.key}-${section.key}`}
          section={section} rows={data[section.key]} renderCard={renderCard} targetIds={newReservationIds} />;
        return <div key={section.key} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.label}</h2>
          {data[section.key].length > 0 ? (
            <div className={styles.cardGrid}>
              {data[section.key].map(renderCard)}
            </div>
          ) : <p className={styles.emptyText}>No reservations to show.</p>}
        </div>;
      })}
    </div>
  );
}
