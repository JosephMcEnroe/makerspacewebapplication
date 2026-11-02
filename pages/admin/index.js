import { useEffect, useState } from "react";
import Head from "next/head";
import StaffNavbar from "@/components/StaffNavbar";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import LineChart from "@/components/LineChart";
import BarChart from "@/components/BarChart";
import MachineUsageList from "@/components/MachineUsageList";
import ActionCard from "@/components/ActionCard";
import { useStaffActivity } from "@/hooks/useStaffActivity";
import styles from "@/styles/AdminDashboard.module.css";

import { loginRedirect } from "@/lib/session";
import { getStaffSession } from "@/lib/staffAuth";

// Only admins can open this page; everyone else is sent to their dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const session = await getStaffSession(req);
  if (!session) {
    return loginRedirect(resolvedUrl);
  }

  if (!session.isAdmin) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
}

const formatMoney = (value) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(value);

// "2026-11-02" -> "Nov 2" (the API sends plain Eastern dates, so format them as UTC)
const formatDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
  timeZone: "UTC", month: "short", day: "numeric",
});

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
  // Live Stripe revenue (gross USD sales, Eastern time, weeks start Monday)
  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRevenue() {
      setRevenueLoading(true);
      setRevenueError(null);
      try {
        const response = await fetch("/api/stripe-reports", { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load revenue");
        if (!controller.signal.aborted) setRevenue(result);
      } catch (err) {
        if (!controller.signal.aborted) setRevenueError(err.message);
      } finally {
        if (!controller.signal.aborted) setRevenueLoading(false);
      }
    }
    loadRevenue();
    return () => controller.abort();
  }, [refresh]);

  const revenueValue = (key) => (revenue ? formatMoney(revenue[key]) : "—");

  // Live RFID check-ins and machine usage (refreshes on its own)
  const { activity, error: activityError } = useStaffActivity();
  const dailyCheckIns = activity?.dailyVisitors.map((row) => ({ label: formatDay(row.day), value: row.visitors })) ?? [];
  const machineUsage = activity?.machineUsageToday.map((machine) => ({
    name: machine.name,
    subtitle: `${machine.hours.toFixed(1)} hrs today`,
    percent: machine.percent,
  })) ?? [];
  // Keep showing the last data if a refresh fails
  const activityNotice = activity ? null : activityError || "Loading activity...";

  return (
    <>
      <Head>
        <title>Admin Dashboard - The Crafty Studio</title>
        <meta name="description" content="Admin dashboard for The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <StaffNavbar role="admin" />
        <div className={styles.content}>
          {/* Server and browser clocks can differ, so let the browser's date win */}
          <p className={styles.date} suppressHydrationWarning>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
          <h1 className={styles.heading}>Revenue &amp; Operations</h1>

          <div className={styles.revenueToolbar}>
            <p className={styles.revenueNotice} role="status">
              {revenueLoading && "Loading revenue..."}
              {!revenueLoading && revenue && (
                <>
                  Gross USD sales before refunds and fees · Updated{" "}
                  {new Intl.DateTimeFormat("en-US", { timeZone: revenue.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(revenue.updatedAt))} ET
                </>
              )}
            </p>
            <button className={styles.refreshButton} disabled={revenueLoading} onClick={() => setRefresh((value) => value + 1)}>
              Refresh revenue
            </button>
          </div>
          {revenueError && <p className={styles.revenueError} role="alert">{revenueError}</p>}

          <div className={styles.statsGrid}>
            <StatCard label="Today" value={revenueValue("today")} icon={DollarIcon} />
            <StatCard label="This Week" value={revenueValue("thisWeek")} icon={DollarIcon} />
            <StatCard label="This Month" value={revenueValue("thisMonth")} icon={DollarIcon} />
          </div>

          <div className={styles.chartsGrid}>
            <ChartCard title="Revenue Trend" subtitle="Last 7 days · USD">
              {revenue ? (
                <LineChart data={revenue.dailyRevenue} formatValue={formatMoney} />
              ) : (
                <p className={styles.revenueNotice}>{revenueLoading ? "Loading revenue..." : "Revenue unavailable"}</p>
              )}
            </ChartCard>
            <ChartCard title="Daily Check-ins" subtitle="Members checked in · last 7 days">
              {activityNotice ? (
                <p className={styles.revenueNotice}>{activityNotice}</p>
              ) : (
                <BarChart data={dailyCheckIns} />
              )}
            </ChartCard>
          </div>

          <div className={styles.usageSection}>
            <ChartCard
              title="Machine Usage Statistics"
              subtitle={`Today's utilization · ${activity ? `${activity.machinesInUse.length} in use now` : "loading"}`}
            >
              {activityNotice ? (
                <p className={styles.revenueNotice}>{activityNotice}</p>
              ) : machineUsage.length === 0 ? (
                <p className={styles.revenueNotice}>No machines yet.</p>
              ) : (
                <MachineUsageList machines={machineUsage} />
              )}
            </ChartCard>
          </div>

          {/* Static quick-action links — no data to wire up, just destinations/handlers */}
          <div className={styles.actionsGrid}>
            <ActionCard
              icon={ActivityIcon}
              title="Live Activity Monitor"
              description="View real-time usage data"
              href="/staff/activity"
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
