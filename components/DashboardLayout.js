import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout({ user, children }) {
  return (
    <div className={styles.pageContainer}>
      <Navbar />
      <main className={styles.mainContent}>
        <div className={styles.layout}>
          <Sidebar user={user} />
          <div className={styles.content}>{children}</div>
        </div>
      </main>
    </div>
  );
}
