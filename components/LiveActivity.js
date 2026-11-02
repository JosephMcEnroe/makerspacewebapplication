import Link from "next/link";
import styles from "@/styles/StaffPages.module.css";
import { formatDate, formatTime } from "@/lib/format";

function fullName(row) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || `Member #${row.user_id}`;
}

// "3:15 PM", or "Nov 1 3:15 PM" when it isn't today
function when(value) {
  return formatDate(value) === formatDate(new Date()) ? formatTime(value) : `${formatDate(value)} ${formatTime(value)}`;
}

function elapsed(value) {
  const minutes = Math.max(Math.round((Date.now() - new Date(value).getTime()) / 60000), 0);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function describe(event) {
  const ended = !!event.end_at;
  if (event.kind === "door") return ended ? "Checked out" : "Checked in";
  if (event.kind === "machine") return `${ended ? "Finished on" : "Started on"} ${event.resource_name}`;
  return `${ended ? "Left" : "Entered"} ${event.resource_name}`;
}

function PeopleList({ rows, emptyText, showResource }) {
  if (rows.length === 0) return <p className={styles.emptyText}>{emptyText}</p>;
  return (
    <div className={styles.reservationList}>
      {rows.map((row) => (
        <div key={row.id} className={styles.reservationItem}>
          <div>
            <p className={styles.reservationName}>
              {showResource ? row.resource_name : <Link href={`/members/${row.user_id}`}>{fullName(row)}</Link>}
            </p>
            <p className={styles.reservationMeta}>
              {showResource && <><Link href={`/members/${row.user_id}`}>{fullName(row)}</Link> · </>}
              since {when(row.start_at)}
            </p>
          </div>
          <span className={`${styles.badge} ${styles.badgeActive}`}>{elapsed(row.start_at)}</span>
        </div>
      ))}
    </div>
  );
}

// Who is checked in and what's in use right now, fed by useStaffActivity().
// Pass showRecent for the full activity page.
export default function LiveActivity({ activity, error, showRecent = false }) {
  if (!activity) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Live Activity</h2>
        {error ? <p className={styles.error} role="alert">{error}</p> : <p className={styles.emptyText}>Loading activity…</p>}
      </section>
    );
  }

  return (
    <>
      {error && <p className={styles.error} role="alert">Could not refresh: {error}</p>}
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>In the Space Now ({activity.checkedIn.length})</h2>
        <PeopleList rows={activity.checkedIn} emptyText="Nobody is checked in right now." />

        <p className={styles.sectionLabel}>Machines in use ({activity.machinesInUse.length})</p>
        <PeopleList rows={activity.machinesInUse} emptyText="No machines in use." showResource />

        <p className={styles.sectionLabel}>Rooms in use ({activity.roomsInUse.length})</p>
        <PeopleList rows={activity.roomsInUse} emptyText="No rooms in use." showResource />

        <p className={styles.hint} style={{ marginTop: "1rem" }} suppressHydrationWarning>
          Updates automatically · last refreshed {formatTime(activity.updatedAt)}
        </p>
      </section>

      {showRecent && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Recent Activity</h2>
          {activity.recent.length === 0 ? (
            <p className={styles.emptyText}>No check-ins or machine use recorded yet.</p>
          ) : (
            <div className={styles.reservationList}>
              {activity.recent.map((event) => (
                <div key={`${event.kind}-${event.id}`} className={styles.reservationItem}>
                  <div>
                    <p className={styles.reservationName}>
                      <Link href={`/members/${event.user_id}`}>{fullName(event)}</Link>
                    </p>
                    <p className={styles.reservationMeta}>{describe(event)}</p>
                  </div>
                  <span className={styles.muted}>{when(event.end_at || event.start_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
