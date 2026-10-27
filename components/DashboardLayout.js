import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout({ children }) {
  return (
    <div className={styles.pageContainer}>
      <Navbar hasSidebar />
      <div className={styles.body}>
        <div className={styles.sidebar}>
          <Sidebar />
        </div>
        <div className={styles.mobileNavigation}>
          <Sidebar />
        </div>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
