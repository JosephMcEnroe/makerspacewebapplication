import { businessTime, businessDateTime } from "@/lib/businessTime";
import Head from "next/head";
import ReservationsPanel from "@/components/ReservationsPanel";
import styles from "@/styles/Account.module.css";
import { query } from "@/lib/db";
import { machineBookingRepository } from "@/Data_Access_Layer/machineBookingRepository";
import { roomReservationRepository } from "@/Data_Access_Layer/roomReservationRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { formatDate, formatTime, formatTimeRange } from "@/lib/format";
import { useRouter } from "next/router";
import { useState } from "react";
import stylesPanel from "@/components/ReservationsPanel.module.css";

function emptyGroups() {
  return { upcoming: [], previous: [], cancelled: [] };
}

// Sorts reservations into upcoming / previous / cancelled for ReservationsPanel
function groupReservations(rows, toCard) {
  const now = new Date();
  const groups = emptyGroups();

  for (const row of rows) {
    const card = toCard(row);
    if (row.status && row.status.toLowerCase().startsWith("cancel")) {
      groups.cancelled.push(card);
    } else if (new Date(row.end ?? row.start) >= now) {
      groups.upcoming.push(card);
    } else {
      groups.previous.push(card);
    }
  }

  return groups;
}

export async function getServerSideProps({ req, resolvedUrl }) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return loginRedirect(resolvedUrl);
  }

  const requestedType = new URL(`http://localhost${resolvedUrl}`).searchParams.get("type");
  const [machineBookings, roomReservations, classEnrollments] = await Promise.all([
    new machineBookingRepository().findUserBooking(sessionUser.user_id),
    new roomReservationRepository().findUserRoomReservations(sessionUser.user_id),
    query(
      `SELECT e.class_id, c.name_of_class, c.class_date, c.class_time
       FROM "class_enrollment" e
       JOIN "class" c ON c.class_id = e.class_id
       WHERE e.user_id = $1
       ORDER BY c.class_date, c.class_time`,
      [sessionUser.user_id]
    ).then(({ rows }) => rows).catch((error) => {
      if (error.code === "42P01") return [];
      throw error;
    }),
  ]);

  const equipment = groupReservations(
    machineBookings.map((booking) => ({ ...booking, start: booking.start_date_time, end: booking.end_date_time })),
    (booking) => ({
      id: `eq-${booking.booking_id}`,
      reservationId: booking.booking_id,
      resourceId: booking.machine_id,
      startDate: booking.start_date_time instanceof Date ? booking.start_date_time.toISOString() : String(booking.start_date_time),
      endDate: booking.end_date_time instanceof Date ? booking.end_date_time.toISOString() : String(booking.end_date_time),
      name: booking.machine_name ?? "Equipment",
      time: formatTimeRange(booking.start_date_time, booking.end_date_time),
      trainingRequired: false,
    })
  );

  const room = groupReservations(
    roomReservations.map((reservation) => ({ ...reservation, start: reservation.start_date, end: reservation.end_date })),
    (reservation) => ({
      id: `rm-${reservation.reservation_id}`,
      reservationId: reservation.reservation_id,
      resourceId: reservation.room_id,
      startDate: reservation.start_date instanceof Date ? reservation.start_date.toISOString() : String(reservation.start_date),
      endDate: reservation.end_date instanceof Date ? reservation.end_date.toISOString() : String(reservation.end_date),
      name: reservation.room_name ?? "Room",
      time: formatTimeRange(reservation.start_date, reservation.end_date),
      trainingRequired: false,
    })
  );

  const classReservations = groupReservations(
    classEnrollments.map((enrollment) => {
      const date = enrollment.class_date instanceof Date
        ? businessDateTime(enrollment.class_date).slice(0, 10)
        : String(enrollment.class_date).slice(0, 10);
      const time = String(enrollment.class_time || "00:00").slice(0, 8);
      const startsAt = new Date(businessTime(`${date}T${time}`));
      return { ...enrollment, start: startsAt, end: startsAt };
    }),
    (enrollment) => ({
      id: `cl-${enrollment.class_id}`,
      reservationId: enrollment.class_id,
      classId: enrollment.class_id,
      startDate: enrollment.start.toISOString(),
      endDate: enrollment.start.toISOString(),
      name: enrollment.name_of_class ?? "Class",
      time: [formatDate(enrollment.start), formatTime(enrollment.class_time)].filter(Boolean).join(" · "),
      trainingRequired: false,
    })
  );

  return {
    props: {
      initialReservationIds: new URL(`http://localhost${resolvedUrl}`).searchParams.getAll("reservationId"),
      reservations: {
        equipment,
        room,
        class: classReservations,
      },
      initialType: requestedType === "rooms" ? "room" : requestedType === "classes" ? "class" : requestedType === "equipment" ? "equipment" : null,
    },
  };
}

export default function ReservationsPage({ reservations, initialType, initialReservationIds = [] }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(null);
  const [actionError, setActionError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const editReservation = (type, reservation) => {
    router.push({ pathname: "/reservations/edit", query: { type, id: reservation.reservationId } });
  };
  const cancelReservation = (type, reservation) => setConfirmation({ type, reservation });
  const confirmCancellation = async () => {
    if (!confirmation) return;
    setIsCancelling(true);
    setActionError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const csrfData = await csrfResponse.json();
      if (!csrfResponse.ok || !csrfData.csrfToken) throw new Error("Could not verify this cancellation.");
      const response = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfData.csrfToken },
        body: JSON.stringify({ type: confirmation.type, reservationId: confirmation.reservation.reservationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not cancel this reservation.");
      setConfirmation(null);
      router.reload();
    } catch (error) {
      setActionError(error.message || "Could not cancel this reservation.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reservations - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio reservations" />
      </Head>
      <h1 className={styles.title}>RESERVATIONS</h1>
      <ReservationsPanel reservations={reservations} initialType={initialType} initialReservationIds={initialReservationIds} onEdit={editReservation} onCancel={cancelReservation} />
      {confirmation && (
        <div className={stylesPanel.confirmBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isCancelling && setConfirmation(null)}>
          <section className={stylesPanel.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="cancel-title">
            <h2 id="cancel-title">Cancel this reservation?</h2>
            <p>Are you sure you want to cancel {confirmation.reservation.name}? This cannot be undone.</p>
            {actionError && <p role="alert">{actionError}</p>}
            <div className={stylesPanel.cardActions}>
              <button type="button" className={stylesPanel.editBtn} disabled={isCancelling} onClick={() => setConfirmation(null)}>Keep Reservation</button>
              <button type="button" className={stylesPanel.cancelBtn} disabled={isCancelling} onClick={confirmCancellation}>{isCancelling ? "Cancelling…" : "Yes, Cancel Reservation"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
