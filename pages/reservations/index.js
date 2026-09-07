import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import ReservationsPanel from "@/components/ReservationsPanel";
import styles from "@/styles/Account.module.css";

// Placeholder until reservation data is wired up to the database
const MOCK_ACCOUNT = {
  firstName: "Alex",
  lastName: "Chen",
  memberSince: "2025",
};

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
};

export default function ReservationsPage() {
  return (
    <>
      <Head>
        <title>Reservations - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio reservations" />
      </Head>
      <DashboardLayout user={{ name: `${MOCK_ACCOUNT.firstName} ${MOCK_ACCOUNT.lastName}`, memberSince: MOCK_ACCOUNT.memberSince }}>
        <h1 className={styles.title}>RESERVATIONS</h1>
        <ReservationsPanel reservations={MOCK_RESERVATIONS} />
      </DashboardLayout>
    </>
  );
}
