import Head from "next/head";
import { getMonthlyReservationCount, isMonthlyReservation, monthlyReservationLabel, monthlyReservationSelectionLabel } from "@/lib/monthlyReservation";
import ReservationEditor from "@/components/ReservationEditor";
import { query } from "@/lib/db";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { loadClasses, loadEquipment, loadRooms } from "@/lib/resources";
import { groupRoomReservations } from "@/lib/reservationGrouping";

function plainDateTime(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getServerSideProps({ req, resolvedUrl, query: routeQuery }) {
  const user = await getSessionUser(req);
  if (!user) return loginRedirect(resolvedUrl);

  const type = routeQuery.type;
  const reservationId = Number(routeQuery.id);
  const requestedReservationIds = type === "room"
    ? [...new Set([reservationId, ...(Array.isArray(routeQuery.reservationIds) ? routeQuery.reservationIds : routeQuery.reservationIds ? [routeQuery.reservationIds] : [])].map(Number))]
    : [reservationId];
  if (!Number.isInteger(reservationId) || reservationId < 1 || requestedReservationIds.some((id) => !Number.isInteger(id) || id < 1) || !["room", "equipment", "class"].includes(type)) {
    return { notFound: true };
  }

  let reservation;
  let resources;
  if (type === "room") {
    const { rows } = await query(
      `SELECT rr.reservation_id, rr.room_id AS resource_id, rr.start_date AS start_time, rr.end_date AS end_time,
              r.name, r.type AS description, rr.stripe_checkout_session_id
       FROM "room_reservation" rr
       JOIN "room" r ON r.room_id = rr.room_id
       WHERE rr.reservation_id = ANY($1::integer[]) AND rr.user_id = $2
         AND (rr.status IS NULL OR LOWER(rr.status) NOT LIKE 'cancel%')
       ORDER BY rr.start_date`,
      [requestedReservationIds, user.user_id]
    );
    if (rows.length !== requestedReservationIds.length) return { notFound: true };
    const grouped = groupRoomReservations(rows);
    if (grouped.length !== 1 || grouped[0].reservation_ids.length !== requestedReservationIds.length) return { notFound: true };
    reservation = grouped[0];
    resources = await loadRooms();
  } else if (type === "equipment") {
    const { rows } = await query(
      `SELECT b.booking_id AS reservation_id, b.machine_id AS resource_id,
              b.start_date_time AS start_time, b.end_date_time AS end_time,
              m.name, m.type AS description
       FROM "machine_booking" b
       JOIN "machine" m ON m.machine_id = b.machine_id
       WHERE b.booking_id = $1 AND b.user_id = $2`,
      [reservationId, user.user_id]
    );
    reservation = rows[0];
    resources = await loadEquipment({ stripe: false });
  } else {
    const { rows } = await query(
      `SELECT e.class_id AS reservation_id, e.class_id, c.name_of_class AS name,
              c.class_date, c.max_capacity
       FROM "class_enrollment" e
       JOIN "class" c ON c.class_id = e.class_id
       WHERE e.class_id = $1 AND e.user_id = $2 AND c.class_date >= CURRENT_DATE`,
      [reservationId, user.user_id]
    );
    reservation = rows[0];
    resources = (await loadClasses()).filter((item) => item.scheduledTime);
  }

  if (!reservation) return { notFound: true };
  const startDate = reservation.start_time ?? reservation.class_date;
  const endDate = reservation.end_time ?? reservation.class_date;
  const roomResources = type === "room" ? resources.flatMap((item) => item.alternatives || [item]) : [];
  const matchingRoom = roomResources.find((item) => String(item.resourceId) === String(reservation.resource_id));
  return {
    props: {
      type,
      reservation: {
        monthly: type === "room" && isMonthlyReservation(startDate, endDate),
        monthCount: type === "room" ? getMonthlyReservationCount(startDate, endDate) : null,
        selectedMonths: reservation.monthly_months?.map(({ start }) => start.slice(0, 7)) || null,
        reservationId: reservation.reservation_id,
        // Only room bookings group several reservation rows
        reservationIds: reservation.reservation_ids ?? null,
        classId: reservation.class_id ?? reservation.reservation_id,
        resourceId: reservation.resource_id ?? reservation.class_id,
        startDate: plainDateTime(startDate),
        endDate: plainDateTime(endDate),
        name: matchingRoom?.displayName || reservation.name,
        time: type === "room" && isMonthlyReservation(startDate, endDate)
          ? monthlyReservationSelectionLabel(reservation.monthly_months?.map(({ start }) => start.slice(0, 7))) || monthlyReservationLabel(startDate, endDate)
          : null,
      },
      resource: type === "class" ? null : {
        resourceId: String(reservation.resource_id),
        name: matchingRoom?.displayName || reservation.name,
        description: reservation.description ?? "",
        monthly: type === "room" && isMonthlyReservation(startDate, endDate),
        reservationId: reservation.reservation_id,
        unavailableIntervals: matchingRoom?.unavailableIntervals ?? [],
      },
      resources: type === "class" ? resources : [],
    },
  };
}

export default function EditReservationPage({ type, reservation, resource, resources }) {
  return (
    <>
      <Head>
        <title>Edit Reservation - The Crafty Studio</title>
        <meta name="description" content="Edit your reservation" />
      </Head>
      <ReservationEditor type={type} reservation={reservation} resource={resource} resources={resources} />
    </>
  );
}
