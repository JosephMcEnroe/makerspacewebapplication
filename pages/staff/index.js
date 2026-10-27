import Head from "next/head";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import ActionCard from "@/components/ActionCard";
import StatCard from "@/components/StatCard";
import styles from "@/styles/StaffDashboard.module.css";
import { useAuthContext } from "@/context/AuthContext";
import { StaffRepository } from "@/Data_Access_Layer/staffRepository";
import { requireStaffPage } from "@/lib/staffAuth";

// Staff and admins can open this page; everyone else is sent to their dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;

  return { props: { stats: await new StaffRepository().getDashboardStats() } };
}

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

export default function StaffDashboardPage({ stats }) {
  const { user } = useAuthContext();
  const statCards = [
    { label: "Active Reservations", value: stats.activeReservations },
    { label: "Active Members", value: stats.activeMembers },
    { label: "Upcoming Classes", value: stats.upcomingClasses },
  ];

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

          <div className={styles.actionsGrid}>
            <ActionCard
              icon={CalendarIcon}
              title="Create a reservation"
              description="Book equipment, rooms, or classes"
              href="/staff/reservations/new"
            />
            <ActionCard
              icon={MembershipIcon}
              title="Manage a membership"
              description="Update member details and status"
              href="/members"
            />
          </div>

          <div className={styles.viewAllWrapper}>
            <Link href="/members" className={styles.viewAllBtn}>
              {PersonIcon}
              View All Members
            </Link>
          </div>

          <div className={styles.statsGrid}>
            {statCards.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
