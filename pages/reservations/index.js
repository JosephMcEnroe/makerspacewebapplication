import Head from "next/head";
import ReservationsPanel from "@/components/ReservationsPanel";
import WeeklyAvailability from "@/components/WeeklyAvailability";
import { useAuthContext } from "@/context/AuthContext";
import { saveClientReservations, subscribeClientReservations, getClientReservationsSnapshot } from "@/lib/clientReservations";
import { getResource, RESOURCE_TYPES } from "@/lib/resources";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import styles from "@/styles/Account.module.css";

// Placeholder until reservation data is wired up to the database
function savedReservationsFromSnapshot(snapshot) {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMinuteOfDay(dateTime) {
  const value = new Date(dateTime);
  return Number.isNaN(value.getTime()) ? null : value.getHours() * 60 + value.getMinutes();
}

function formatReservationTime(start, end) {
  const dateString = start.slice(0, 10);
  const date = new Date(`${dateString}T12:00:00`);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formatTime = (value) => {
    const minutes = getMinuteOfDay(value);
    if (minutes === null) return "";
    const time = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
    return time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return `${dateLabel} · ${formatTime(start)}–${formatTime(end)}`;
}

function combineAdjacentReservations(reservations) {
  const groups = new Map();
  const ungrouped = [];

  for (const reservation of reservations) {
    if (!reservation.start || !reservation.end) {
      ungrouped.push(reservation);
      continue;
    }

    const key = [
      reservation.type,
      reservation.resourceId || reservation.name,
      reservation.status,
      reservation.notes || "",
      reservation.start.slice(0, 10),
    ].join(":");
    const group = groups.get(key) || [];
    group.push({ ...reservation });
    groups.set(key, group);
  }

  const merged = [...ungrouped];
  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.start) - new Date(b.start));
    const combined = [];

    for (const reservation of group) {
      const previous = combined[combined.length - 1];
      const previousEnd = previous ? new Date(previous.end).getTime() : NaN;
      const reservationStart = new Date(reservation.start).getTime();

      if (previous && previousEnd === reservationStart) {
        previous.end = reservation.end;
        previous.reservationIds = [
          ...(previous.reservationIds || [previous.id]),
          ...(reservation.reservationIds || [reservation.id]),
        ];
        previous.time = formatReservationTime(previous.start, previous.end);
      } else {
        combined.push({
          ...reservation,
          reservationIds: reservation.reservationIds || [reservation.id],
        });
      }
    }

    merged.push(...combined);
  }

  return merged.sort((a, b) => {
    if (!a.start) return 1;
    if (!b.start) return -1;
    return new Date(a.start) - new Date(b.start);
  });
}

const MOCK_RESERVATIONS = {
  equipment: {
    upcoming: [
      { id: "eq-1", name: "3D Printer", resourceId: "3d-printer", type: "equipment", time: "Upcoming · 4:00 PM–6:00 PM", trainingRequired: false, canEdit: true, canCancel: true },
      { id: "eq-2", name: "Laser Cutter", resourceId: "laser-cutter-pro", type: "equipment", time: "Upcoming · 4:00 PM–6:00 PM", trainingRequired: true, canEdit: true, canCancel: true },
    ],
    previous: [{ id: "eq-3", name: "Wood Lathe", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    cancelled: [],
  },
  class: {
    upcoming: [{ id: "cl-1", name: "Intro to Ceramics", resourceId: "intro-to-ceramics", type: "classes", time: "Upcoming · 4:00 PM–6:00 PM", trainingRequired: false, canEdit: true, canCancel: true }],
    previous: [],
    cancelled: [],
  },
  room: {
    upcoming: [{ id: "rm-1", name: "Ceramics Studio", resourceId: "ceramics-studio", type: "rooms", time: "Upcoming · 4:00 PM–6:00 PM", trainingRequired: false, canEdit: true, canCancel: true }],
    previous: [{ id: "rm-2", name: "Woodshop", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    cancelled: [],
  },
};

export default function ReservationsPage() {
  const { user } = useAuthContext();
  const [editingReservation, setEditingReservation] = useState(null);
  const [editingSlots, setEditingSlots] = useState([]);
  const getSnapshot = useCallback(
    () => getClientReservationsSnapshot(user?.id),
    [user?.id]
  );
  const snapshot = useSyncExternalStore(
    subscribeClientReservations,
    getSnapshot,
    () => "[]"
  );
  const cancelReservation = (reservation) => {
    const ids = reservation.reservationIds || [reservation.id];
    const updated = savedReservationsFromSnapshot(snapshot).map((entry) =>
      ids.includes(entry.id) ? { ...entry, status: "cancelled" } : entry
    );
    saveClientReservations(user?.id, updated);
  };
  const deleteCancelledReservation = (reservation) => {
    const ids = reservation.reservationIds || [reservation.id];
    const updated = savedReservationsFromSnapshot(snapshot).filter(
      (entry) => !ids.includes(entry.id)
    );
    saveClientReservations(user?.id, updated);
  };

  const editReservation = (reservation) => {
    if (!reservation.resourceId) return;

    const resourceType = reservation.type;
    const resource = getResource(resourceType, reservation.resourceId);
    if (!resource) return;

    // Seed placeholder reservations with a near-future editable time so they
    // can use the same availability-table edit flow as saved bookings.
    let { start: reservationStart, end: reservationEnd } = reservation;
    if (!reservationStart || !reservationEnd) {
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      const year = nextDay.getFullYear();
      const month = String(nextDay.getMonth() + 1).padStart(2, "0");
      const day = String(nextDay.getDate()).padStart(2, "0");
      const date = `${year}-${month}-${day}`;
      reservationStart = `${date}T16:00:00`;
      reservationEnd = `${date}T18:00:00`;
    }

    const startMatch = reservationStart.match(/T([0-9]{2}):([0-9]{2})/);
    const endMatch = reservationEnd.match(/T([0-9]{2}):([0-9]{2})/);
    if (!startMatch || !endMatch) return;

    const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
    const endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
    const slots = [];
    for (let start = startMinutes; start < endMinutes; start += 60) {
      slots.push({
        date: reservationStart.slice(0, 10),
        start,
        end: Math.min(start + 60, endMinutes),
      });
    }

    setEditingSlots(slots);
    setEditingReservation({
      ...reservation,
      type: resourceType,
      resource,
      reservationIds: reservation.reservationIds || [reservation.id],
    });
  };

  const saveEditedReservation = () => {
    if (!editingReservation || editingSlots.length === 0) return;

    const updated = savedReservationsFromSnapshot(snapshot);
    const ids = editingReservation.reservationIds;
    const retained = updated.filter((entry) => !ids.includes(entry.id));
    const now = new Date().toISOString();
    const replacements = editingSlots.map((slot, index) => {
      const date = new Date(`${slot.date}T00:00:00`);
      date.setMinutes(date.getMinutes() + slot.start);
      const end = new Date(`${slot.date}T00:00:00`);
      end.setMinutes(end.getMinutes() + slot.end);
      const startDateTime = `${slot.date}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
      const endDateTime = `${slot.date}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;
      const dateLabel = new Date(`${slot.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
      const formatMinutes = (value) => new Date(2000, 0, 1, Math.floor(value / 60), value % 60)
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      return {
        id: index === 0 ? ids[0] : `reservation-${Date.now()}-${index}`,
        type: editingReservation.type,
        resourceId: editingReservation.resourceId,
        name: editingReservation.name,
        start: startDateTime,
        end: endDateTime,
        time: `${dateLabel} · ${formatMinutes(slot.start)}–${formatMinutes(slot.end)}`,
        status: "upcoming",
        notes: editingReservation.notes || "",
        createdAt: now,
      };
    });

    if (saveClientReservations(user?.id, [...retained, ...replacements])) {
      setEditingReservation(null);
      setEditingSlots([]);
    }
  };

  const reservations = useMemo(() => {
    let saved = [];
    try {
      const parsed = JSON.parse(snapshot);
      saved = Array.isArray(parsed) ? parsed : [];
    } catch {
      saved = [];
    }

    const savedIds = new Set(saved.map((reservation) => reservation.id));
    const remainingMocks = Object.fromEntries(
      Object.entries(MOCK_RESERVATIONS).map(([type, sections]) => [
        type,
        Object.fromEntries(
          Object.entries(sections).map(([section, entries]) => [
            section,
            entries.filter((entry) => !savedIds.has(entry.id)),
          ])
        ),
      ])
    );

    const grouped = {
      class: { upcoming: [], previous: [], cancelled: [] },
      room: { upcoming: [], previous: [], cancelled: [] },
      equipment: { upcoming: [], previous: [], cancelled: [] },
    };

    for (const reservation of combineAdjacentReservations(saved)) {
      const groupKey = reservation.type === "classes" ? "class" : reservation.type === "rooms" ? "room" : "equipment";
      const section = grouped[groupKey][reservation.status] ? reservation.status : "upcoming";
      grouped[groupKey][section].push({
        id: reservation.id,
        name: reservation.name,
        time: reservation.time,
        trainingRequired: false,
        reservationIds: reservation.reservationIds || [reservation.id],
        type: reservation.type,
        resourceId: reservation.resourceId,
        start: reservation.start,
        end: reservation.end,
        canCancel: true,
        canDelete: reservation.status === "cancelled",
        canEdit: reservation.status === "upcoming" && Boolean(reservation.resourceId && getResource(reservation.type, reservation.resourceId)),
      });
    }

    return {
      class: {
        ...remainingMocks.class,
        upcoming: [...grouped.class.upcoming, ...remainingMocks.class.upcoming],
        previous: [...grouped.class.previous, ...remainingMocks.class.previous],
        cancelled: [...grouped.class.cancelled, ...remainingMocks.class.cancelled],
      },
      room: {
        ...remainingMocks.room,
        upcoming: [...grouped.room.upcoming, ...remainingMocks.room.upcoming],
        previous: [...grouped.room.previous, ...remainingMocks.room.previous],
        cancelled: [...grouped.room.cancelled, ...remainingMocks.room.cancelled],
      },
      equipment: {
        ...remainingMocks.equipment,
        upcoming: [...grouped.equipment.upcoming, ...remainingMocks.equipment.upcoming],
        previous: [...grouped.equipment.previous, ...remainingMocks.equipment.previous],
        cancelled: [...grouped.equipment.cancelled, ...remainingMocks.equipment.cancelled],
      },
    };
  }, [snapshot]);

  return (
    <>
      <Head>
        <title>Reservations - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio reservations" />
      </Head>
      <h1 className={styles.title}>RESERVATIONS</h1>
      <ReservationsPanel
        reservations={reservations}
        onCancelReservation={cancelReservation}
        onDeleteCancelledReservation={deleteCancelledReservation}
        onEditReservation={editReservation}
      />
      {editingReservation && (
        <div className={styles.editModalBackdrop} onClick={() => setEditingReservation(null)}>
          <section
            className={styles.editModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-reservation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.editModalClose}
              onClick={() => setEditingReservation(null)}
              aria-label="Close edit reservation"
            >
              ×
            </button>
            <h2 id="edit-reservation-title">Edit {editingReservation.name}</h2>
            <p>Change this reservation by adding green times, removing selected gold times, or both.</p>
            <WeeklyAvailability
              type={editingReservation.type}
              typeLabel={`${RESOURCE_TYPES[editingReservation.type].label}: ${editingReservation.name}`}
              selectable
              selectedSlots={editingSlots}
              allowSelectedUnavailable
              initialDate={editingSlots[0]?.date}
              onToggleSlot={(slot) => {
                const key = `${slot.date}:${slot.start}`;
                setEditingSlots((current) =>
                  current.some((entry) => `${entry.date}:${entry.start}` === key)
                    ? current.filter((entry) => `${entry.date}:${entry.start}` !== key)
                    : [...current, slot].sort((a, b) => `${a.date}:${a.start}`.localeCompare(`${b.date}:${b.start}`))
                );
              }}
            />
            <p className={styles.editSlotSummary} aria-live="polite">
              {editingSlots.length} time {editingSlots.length === 1 ? "slot" : "slots"} selected · changes are saved to this reservation
            </p>
            <div className={styles.editModalActions}>
              <button
                type="button"
                className={styles.editModalSecondary}
                onClick={() => setEditingReservation(null)}
              >
                Keep Reservation
              </button>
              <button
                type="button"
                className={styles.editModalPrimary}
                onClick={saveEditedReservation}
                disabled={editingSlots.length === 0}
              >
                Save Changes
              </button>
            </div>
          </section>
        </div>
      )}
    </>

  );
}
