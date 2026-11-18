import { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import StaffNavbar from "@/components/StaffNavbar";
import { useAuthContext } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout({ children }) {
  const layoutRef = useRef(null);
  const headerRef = useRef(null);
  const { user } = useAuthContext();
  // Staff/admins reach shared pages (e.g. /equipment) from their navbar, so
  // keep it here too to give them a way back to their dashboard
  const staffRole = user?.isAdmin ? "admin" : user?.isStaff ? "staff" : null;

  useEffect(() => {
    const layout = layoutRef.current;
    const header = headerRef.current;

    function updateHeaderHeight() {
      layout.style.setProperty("--dashboard-header-height", `${header.getBoundingClientRect().height}px`);
    }

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={layoutRef} className={styles.pageContainer}>
      <div ref={headerRef} className={styles.header}>
        {staffRole ? <StaffNavbar role={staffRole} /> : <Navbar />}
      </div>
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
