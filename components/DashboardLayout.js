import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout({ user, children }) {
  return (
    <div className={styles.pageContainer}>
      <Navbar />
      <div className={styles.body}>
        <div className={styles.sidebar}>
          <Sidebar user={user} />
        </div>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
