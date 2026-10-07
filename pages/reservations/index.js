import Head from "next/head";
import ReservationsPanel from "@/components/ReservationsPanel";
import styles from "@/styles/Account.module.css";
import { machineBookingRepository } from "@/Data_Access_Layer/machineBookingRepository";
import { roomReservationRepository } from "@/Data_Access_Layer/roomReservationRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { formatTimeRange } from "@/lib/format";

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

  const [machineBookings, roomReservations] = await Promise.all([
    new machineBookingRepository().findUserBooking(sessionUser.user_id),
    new roomReservationRepository().findUserRoomReservations(sessionUser.user_id),
  ]);

  const equipment = groupReservations(
    machineBookings.map((booking) => ({ ...booking, start: booking.start_date_time, end: booking.end_date_time })),
    (booking) => ({
      id: `eq-${booking.booking_id}`,
      name: booking.machine_name ?? "Equipment",
      time: formatTimeRange(booking.start_date_time, booking.end_date_time),
      trainingRequired: false,
    })
  );

  const room = groupReservations(
    roomReservations.map((reservation) => ({ ...reservation, start: reservation.start_date, end: reservation.end_date })),
    (reservation) => ({
      id: `rm-${reservation.reservation_id}`,
      name: reservation.room_name ?? "Room",
      time: formatTimeRange(reservation.start_date, reservation.end_date),
      trainingRequired: false,
    })
  );

  return {
    props: {
      reservations: {
        equipment,
        room,
        // No class enrollment table yet
        class: emptyGroups(),
      },
    },
  };
}

export default function ReservationsPage({ reservations }) {
  return (
    <>
      <Head>
        <title>Reservations - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio reservations" />
      </Head>
      <h1 className={styles.title}>RESERVATIONS</h1>
      <ReservationsPanel reservations={reservations} />
    </>
  );
}
