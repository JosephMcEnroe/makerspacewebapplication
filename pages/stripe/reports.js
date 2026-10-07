import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import LineChart from "@/components/LineChart";
import styles from "@/styles/AdminDashboard.module.css";
import reportsStyles from "@/styles/StripeReports.module.css";

const formatMoney = (value) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(value);

export default function StripeReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRevenue() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/stripe-reports", { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load revenue");
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadRevenue();
    return () => controller.abort();
  }, [refresh]);

  return (
    <div className={`${styles.page} ${reportsStyles.page}`}>
      <Head><title>Revenue Reports - The Crafty Studio</title></Head>
      <StaffNavbar role="admin" reportsHref="/stripe/reports" />
      <main className={styles.content}>
        <div className={reportsStyles.toolbar}>
          <div>
            <p className={styles.date}>ADMIN / REVENUE</p>
            <h1 className={styles.heading}>Revenue Reports</h1>
            <p className={reportsStyles.description}>Gross USD sales before refunds and fees. Eastern time; weeks start Monday.</p>
          </div>
          <div className={reportsStyles.controls}>
            <Link className={reportsStyles.secondaryButton} href="/stripe">Stripe Debugging</Link>
            <button className={reportsStyles.button} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh revenue</button>
          </div>
        </div>
        {loading && <p className={reportsStyles.notice} role="status">Loading revenue...</p>}
        {error && <p className={reportsStyles.error} role="alert">{error}</p>}
        {!loading && !error && data && (
          <>
            <div className={styles.statsGrid}>
              <StatCard label="Today" value={formatMoney(data.today)} />
              <StatCard label="This Week" value={formatMoney(data.thisWeek)} />
              <StatCard label="This Month" value={formatMoney(data.thisMonth)} />
            </div>
            <ChartCard title="Revenue Trend" subtitle="Last 7 days · USD">
              <LineChart data={data.dailyRevenue} formatValue={formatMoney} />
            </ChartCard>
            <p className={reportsStyles.notice}>
              Updated {new Intl.DateTimeFormat("en-US", { timeZone: data.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))} ET.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
