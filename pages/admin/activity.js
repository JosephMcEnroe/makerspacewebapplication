import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import StatCard from "@/components/StatCard";
import styles from "@/styles/ActivityLog.module.css";

import { loginRedirect } from "@/lib/session";
import { getStaffSession } from "@/lib/staffAuth";

const REFRESH_MS = 15000;

const RANGES = [
  { value: "hour", label: "Last hour" },
  { value: "day", label: "Last 24 hours" },
];

const STATUSES = [
  { value: "all", label: "All taps" },
  { value: "granted", label: "Granted" },
  { value: "denied", label: "Denied" },
];

// Only admins can open this page; everyone else is sent to their dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const session = await getStaffSession(req);
  if (!session) return loginRedirect(resolvedUrl);
  if (!session.isAdmin) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
}

// Polls the activity API so new card taps show up without a refresh.
// Pauses while the tab is hidden and reloads right away when it comes back.
function useActivity(range, status) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      clearTimeout(timer);
      if (!document.hidden) {
        try {
          const response = await fetch(`/api/admin/activity?range=${range}&status=${status}`);
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Could not load activity.");
          if (!cancelled) {
            setData(result);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) setError(err.message || "Could not load activity.");
        }
      }
      if (!cancelled) timer = setTimeout(load, REFRESH_MS);
    }

    const onVisibilityChange = () => {
      if (!document.hidden) load();
    };

    load();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [range, status]);

  // Hide the previous range/filter's results until the new ones arrive
  const current = data && data.range === range && data.status === status ? data : null;
  return { data: current, error };
}

function locationLabel(event) {
  if (event.locationType === "door") return "Front door";
  const kind = event.locationType === "machine" ? "Machine" : "Room";
  return event.resourceName ? `${kind}: ${event.resourceName}` : kind;
}

function formatTime(value, range) {
  const date = new Date(value);
  const options = { hour: "numeric", minute: "2-digit", second: "2-digit" };
  if (range === "day") Object.assign(options, { month: "short", day: "numeric" });
  return date.toLocaleString("en-US", options);
}

function Toggle({ options, value, onChange, label }) {
  return (
    <div className={styles.toggle} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.toggleButton} ${value === option.value ? styles.toggleActive : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminActivityPage() {
  const [range, setRange] = useState("hour");
  const [status, setStatus] = useState("all");
  const { data, error } = useActivity(range, status);
  const counts = data?.counts;
  const rangeLabel = range === "hour" ? "last hour" : "last 24 hours";

  const stats = counts
    ? [
        { label: "Total taps", value: counts.total },
        { label: "Granted", value: counts.granted },
        { label: "Denied", value: counts.denied },
        { label: "Members", value: counts.uniqueMembers },
        { label: "Door check-ins", value: counts.doorCheckIns },
        { label: "Machine sessions", value: counts.machineSessions },
        { label: "Room sessions", value: counts.roomSessions },
      ]
    : [];

  return (
    <>
      <Head>
        <title>Live Activity - The Crafty Studio</title>
        <meta name="description" content="Live card tap activity for The Crafty Studio" />
      </Head>
      <div className={styles.page}>
        <StaffNavbar role="admin" />
        <div className={styles.content}>
          <Link href="/admin" className={styles.backLink}>← Dashboard</Link>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.heading}>Live Activity</h1>
              <p className={styles.subheading}>
                Card taps in the {rangeLabel}. Updates every 15 seconds.
              </p>
            </div>
            <Toggle options={RANGES} value={range} onChange={setRange} label="Time range" />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.statsGrid}>
            {counts
              ? stats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} />)
              : <p className={styles.muted}>Loading activity…</p>}
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Card Log</h2>
              <Toggle options={STATUSES} value={status} onChange={setStatus} label="Tap result" />
            </div>

            {!data ? (
              <p className={styles.muted}>Loading card log…</p>
            ) : data.events.length === 0 ? (
              <p className={styles.muted}>No {status === "all" ? "" : `${status} `}taps in the {rangeLabel}.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Member</th>
                      <th scope="col">Card</th>
                      <th scope="col">Location</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event, index) => (
                      <tr key={`${event.locationType}-${event.tappedAt}-${event.userId}-${index}`}>
                        <td className={styles.nowrap}>{formatTime(event.tappedAt, range)}</td>
                        <td>
                          <Link href={`/members/${event.userId}`} className={styles.memberLink}>
                            {event.name || `Member #${event.userId}`}
                          </Link>
                        </td>
                        <td className={styles.mono}>{event.cardId || "—"}</td>
                        <td>{locationLabel(event)}</td>
                        <td>
                          <span className={`${styles.badge} ${event.granted ? styles.granted : styles.denied}`}>
                            {event.granted ? "Granted" : "Denied"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data?.truncated && (
              <p className={styles.muted}>Showing the {data.events.length} most recent taps.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
