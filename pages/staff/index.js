import Head from "next/head";
import StaffNavbar from "@/components/StaffNavbar";
import ActionCard from "@/components/ActionCard";
import StatCard from "@/components/StatCard";
import styles from "@/styles/StaffDashboard.module.css";

const TODAY_LABEL = "Monday, March 12";

// Placeholder until reservation/member/class data is wired up to the database
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
  return (
    <>
      <Head>
        <title>Staff Dashboard - The Crafty Studio</title>
        <meta name="description" content="Staff dashboard for The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <StaffNavbar role="staff" />

        <div className={styles.content}>
          <p className={styles.date}>{TODAY_LABEL}</p>
          <h1 className={styles.greeting}>Hello, Staff!</h1>

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
