import Head from "next/head";
import StaffNavbar from "@/components/StaffNavbar";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import LineChart from "@/components/LineChart";
import BarChart from "@/components/BarChart";
import MachineUsageList from "@/components/MachineUsageList";
import ActionCard from "@/components/ActionCard";
import styles from "@/styles/AdminDashboard.module.css";

const DATE_LABEL = "Mon, Mar 12, 2026";

// Placeholder until revenue/usage data is wired up to the database
const REVENUE_STATS = [
  { label: "Today", value: "$4,200", delta: { text: "+12% from yesterday", positive: true } },
  { label: "This Week", value: "$24,130", delta: { text: "+8% from last week", positive: true } },
  { label: "This Month", value: "$38,420", delta: { text: "+15% from last month", positive: true } },
];

const REVENUE_TREND = [
  { label: "Mar 7", value: 3200 },
  { label: "Mar 8", value: 4100 },
  { label: "Mar 9", value: 3600 },
  { label: "Mar 10", value: 4700 },
  { label: "Mar 11", value: 3900 },
  { label: "Mar 12", value: 4200 },
];

const MEMBERSHIP_ENTRIES = [
  { label: "Mar 7", value: 5 },
  { label: "Mar 8", value: 8 },
  { label: "Mar 9", value: 6 },
  { label: "Mar 10", value: 9 },
  { label: "Mar 11", value: 7 },
  { label: "Mar 12", value: 10 },
];

const MACHINE_USAGE = [
  { name: "3D Printer", subtitle: "34.0 hrs this week", percent: 85 },
  { name: "Laser Cutter", subtitle: "28.8 hrs this week", percent: 72 },
  { name: "CNC Mill", subtitle: "31.2 hrs this week", percent: 78 },
  { name: "Vinyl Cutter", subtitle: "23.2 hrs this week", percent: 58 },
  { name: "Wood Lathe", subtitle: "24.8 hrs this week", percent: 62 },
];

const DollarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ActivityIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const MembersIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ExportIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export default function AdminDashboardPage() {
  return (
    <>
      <Head>
        <title>Admin Dashboard - The Crafty Studio</title>
        <meta name="description" content="Admin dashboard for The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <StaffNavbar role="admin" />

        <div className={styles.content}>
          <p className={styles.date}>{DATE_LABEL}</p>
          <h1 className={styles.heading}>Revenue &amp; Operations</h1>

          <div className={styles.statsGrid}>
            {REVENUE_STATS.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} icon={DollarIcon} delta={stat.delta} />
            ))}
          </div>

          <div className={styles.chartsGrid}>
            <ChartCard title="Revenue Trend" subtitle="Last 6 days">
              <LineChart data={REVENUE_TREND} formatValue={(v) => `$${v.toLocaleString()}`} />
            </ChartCard>
            <ChartCard title="Daily Membership Entries" subtitle="Last 6 days">
              <BarChart data={MEMBERSHIP_ENTRIES} />
            </ChartCard>
          </div>

          <div className={styles.usageSection}>
            <ChartCard title="Machine Usage Statistics" subtitle="Today's Utilization">
              <MachineUsageList machines={MACHINE_USAGE} />
            </ChartCard>
          </div>

          <div className={styles.actionsGrid}>
            <ActionCard
              icon={ActivityIcon}
              title="Live Activity Monitor"
              description="View real-time usage data"
              onClick={() => console.log("Live activity monitor")}
            />
            <ActionCard
              icon={MembersIcon}
              title="Member Management"
              description="Add, edit, or suspend members"
              href="/members"
            />
            <ActionCard
              icon={ExportIcon}
              title="Export Reports"
              description="Generate financial and usage reports"
              href="/reports"
            />
          </div>
        </div>
      </div>
    </>
  );
}
