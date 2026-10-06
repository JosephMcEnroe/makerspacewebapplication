import Head from "next/head";
import { parse } from "cookie";
import ReservationsPanel from "@/components/ReservationsPanel";
import styles from "@/styles/Account.module.css";
import MachineBookingRepository from "@/Data_Access_Layer/machineBookingRepository";
import UserRepository from "@/Data_Access_Layer/UserRepository";

// Placeholder until reservation data is wired up to the database
const MOCK_RESERVATIONS = {
  equipment: {
    upcoming: [
      { id: "eq-1", name: "3D Printer", time: "4:15 PM - 6:15 PM", trainingRequired: false },
      { id: "eq-2", name: "Laser Cutter", time: "4:15 PM - 6:15 PM", trainingRequired: true },
    ],
    previous: [{ id: "eq-3", name: "Wood Lathe", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    cancelled: [{ id: "eq-4", name: "Vinyl Cutter", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
  },
  class: {
    upcoming: [{ id: "cl-1", name: "Intro to Ceramics", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    previous: [],
    cancelled: [],
  },
  room: {
    upcoming: [{ id: "rm-1", name: "Ceramics Studio", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    previous: [{ id: "rm-2", name: "Woodshop", time: "4:15 PM - 6:15 PM", trainingRequired: false }],
    cancelled: [],
  },
};
export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || "");
  const sessionId = cookies.session_id;
  if (!sessionId) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  const userQuery = new UserRepository();
  const bookingQuery = new MachineBookingRepository();

  const session = await userQuery.findByCookie(sessionId);
  
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  
  const userId = session.user_id;
  
  const bookings = await bookingQuery.findUserBooking(userId);

  const upcoming = [];
  const previous = [];
  const now = new Date();

  for (const booking of bookings) {
    const startDate = new Date(booking.start_date_time);
    const endDate = new Date(booking.end_date_time);
    const reservation = {
      id: booking.booking_id,
      name: booking.machine_name,
      time: `${startDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })} - ${endDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`,
      trainingRequired: false, //Fix later
    };
    // If reservation has ended
    if (endDate <= now) {
      previous.push(reservation);
    } else {
      upcoming.push(reservation);
    }
  }
  //replace const reservations (equipments, class, and room) to update
  const reservations = {
    equipment: {
      upcoming: upcoming,
      previous: previous,
      cancelled: [],
    },
    class: {
      upcoming: [],
      previous: [],
      cancelled: [],
    },
    room: {
      upcoming: [],
      previous: [],
      cancelled: [],
    },

  };

  return {
    props: {
      reservations,
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
