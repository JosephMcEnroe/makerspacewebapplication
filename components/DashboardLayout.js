import Navbar from "@/components/Navbar";
import StaffNavbar from "@/components/StaffNavbar";
import { useAuthContext } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout({ children }) {
  const { user } = useAuthContext();
  // Staff/admins reach shared pages (e.g. /equipment) from their navbar, so
  // keep it here too to give them a way back to their dashboard
  const staffRole = user?.isAdmin ? "admin" : user?.isStaff ? "staff" : null;

  return (
    <div className={styles.pageContainer}>
      {staffRole ? <StaffNavbar role={staffRole} /> : <Navbar />}
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
