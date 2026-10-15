import Head from "next/head";
import ReservationEditor from "@/components/ReservationEditor";
import { query } from "@/lib/db";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { loadClasses, loadEquipment, loadRooms } from "@/lib/resources";

function plainDateTime(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getServerSideProps({ req, resolvedUrl, query: routeQuery }) {
  const user = await getSessionUser(req);
  if (!user) return loginRedirect(resolvedUrl);

  const type = routeQuery.type;
  const reservationId = Number(routeQuery.id);
  if (!Number.isInteger(reservationId) || reservationId < 1 || !["room", "equipment", "class"].includes(type)) {
    return { notFound: true };
  }

  let reservation;
  let resources;
  if (type === "room") {
    const { rows } = await query(
      `SELECT rr.reservation_id, rr.room_id AS resource_id, rr.start_date AS start_time, rr.end_date AS end_time,
              r.name, r.type AS description
       FROM "room_reservation" rr
       JOIN "room" r ON r.room_id = rr.room_id
       WHERE rr.reservation_id = $1 AND rr.user_id = $2
         AND (rr.status IS NULL OR LOWER(rr.status) NOT LIKE 'cancel%')`,
      [reservationId, user.user_id]
    );
    reservation = rows[0];
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
    resources = await loadEquipment();
  } else {
    const { rows } = await query(
      `SELECT e.class_id AS reservation_id, e.class_id, c.name_of_class AS name,
              c.class_date, c.class_time, c.max_capacity
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
  return {
    props: {
      type,
      reservation: {
        reservationId: reservation.reservation_id,
        classId: reservation.class_id ?? reservation.reservation_id,
        resourceId: reservation.resource_id ?? reservation.class_id,
        startDate: plainDateTime(startDate),
        endDate: plainDateTime(endDate),
        name: reservation.name,
      },
      resource: type === "class" ? null : {
        resourceId: String(reservation.resource_id),
        name: reservation.name,
        description: reservation.description ?? "",
        reservationId: reservation.reservation_id,
        unavailableIntervals: resources
          .find((item) => String(item.resourceId) === String(reservation.resource_id))?.unavailableIntervals ?? [],
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
