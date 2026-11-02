import Head from "next/head";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import LiveActivity from "@/components/LiveActivity";
import styles from "@/styles/StaffPages.module.css";
import { requireStaffPage } from "@/lib/staffAuth";
import { useStaffActivity } from "@/hooks/useStaffActivity";

// Staff and admins can open this page; everyone else is sent to their dashboard
export async function getServerSideProps({ req, resolvedUrl }) {
  const guard = await requireStaffPage(req, resolvedUrl);
  if (guard.deny) return guard.deny;
  return { props: { navRole: guard.navRole } };
}

export default function LiveActivityPage({ navRole }) {
  const { activity, error } = useStaffActivity();

  return (
    <>
      <Head>
        <title>Live Activity - The Crafty Studio</title>
      </Head>
      <div className={styles.page}>
        <StaffNavbar role={navRole} />
        <div className={styles.content}>
          <Link href={navRole === "admin" ? "/admin" : "/staff"} className={styles.backLink}>← Dashboard</Link>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>RFID check-ins</p>
              <h1 className={styles.heading}>Live Activity</h1>
              <p className={styles.subheading}>
                {activity ? `${activity.visitorsToday} member${activity.visitorsToday === 1 ? "" : "s"} checked in today` : "Loading…"}
              </p>
            </div>
          </div>
          <LiveActivity activity={activity} error={error} showRecent />
        </div>
      </div>
    </>
  );
}
