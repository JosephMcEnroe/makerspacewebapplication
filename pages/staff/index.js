import Head from "next/head";
import StaffNavbar from "@/components/StaffNavbar";
import ActionCard from "@/components/ActionCard";
import StatCard from "@/components/StatCard";
import styles from "@/styles/StaffDashboard.module.css";
import { useAuthContext } from "@/context/AuthContext";
import { StaffRepository } from "@/Data_Access_Layer/staffRepository";
import { adminRepository } from "@/Data_Access_Layer/adminRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";

// Staff and admins can open this page; everyone else is sent to their dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return loginRedirect(resolvedUrl);
  }

  const [isStaff, isAdmin] = await Promise.all([
    new StaffRepository().isStaff(sessionUser.user_id),
    new adminRepository().isAdmin(sessionUser.user_id),
  ]);
  if (!isStaff && !isAdmin) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
}

// Dummy data — once a database is connected, these stat cards should pull
// live reservation, member, and class counts instead of hardcoded values.
const STATS = [
  { label: "Active Reservations Today", value: "24" },
  { label: "Total Members", value: "148" },
  { label: "Upcoming Classes", value: "7" },
];

const CalendarIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
    <path d="m9 16 2 2 4-4" />
  </svg>
);

const MembershipIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const PersonIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const InfoIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export default function StaffDashboardPage() {
  const { user } = useAuthContext();

  return (
    <>
      <Head>
        <title>Staff Dashboard - The Crafty Studio</title>
        <meta name="description" content="Staff dashboard for The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <StaffNavbar role="staff" />

        <div className={styles.content}>
          {/* Server and browser clocks can differ, so let the browser's date win */}
          <p className={styles.date} suppressHydrationWarning>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className={styles.greeting}>Hello, {user?.firstName || "Staff"}!</h1>

          {/* Static quick-action links — no data to wire up, just handlers */}
          <div className={styles.actionsGrid}>
            <ActionCard
              icon={CalendarIcon}
              title="Create a reservation"
              description="Book equipment, rooms, or classes"
              onClick={() => console.log("Create a reservation")}
            />
            <ActionCard
              icon={MembershipIcon}
              title="Manage a membership"
              description="Update member details and status"
              onClick={() => console.log("Manage a membership")}
            />
          </div>

          <div className={styles.viewAllWrapper}>
            <button type="button" className={styles.viewAllBtn} onClick={() => console.log("View all members")}>
              {PersonIcon}
              View All Members
            </button>
          </div>

          {/* Dummy data — see STATS above; wire up to the database once it exists */}
          <div className={styles.statsGrid}>
            {STATS.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} icon={InfoIcon} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
