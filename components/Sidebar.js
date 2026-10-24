import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import styles from "./Sidebar.module.css";

const SERVICE_ITEMS = [
  {
    label: "Browse equipment",
    href: "/equipment",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6" /></svg>,
  },
  {
    label: "Find a room",
    href: "/rooms",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-6h6v6M9 7h.01M15 7h.01M9 11h.01M15 11h.01" /></svg>,
  },
  {
    label: "Classes",
    href: "/classes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>,
  },
];

const NAV_ITEMS = [
  {
    label: "Account Information",
    href: "/account",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "Membership Management",
    href: "/membership",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
];

// Person silhouette SVG to match the mockup avatar style
function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b1916" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const mobileMenuId = useId();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {
    user,
    logout,
  } = useAuth();

  const handleLogout = async () => {
    // Future: clear auth session before redirecting
    //Come back if error show up - check with user data, maybe passing it in?
    const isTrue = await logout();

    if(isTrue)
      router.push("/login");
    else
      return;
  };

  return (
    <aside className={styles.sidebar}>
      <button
        type="button"
        className={styles.mobileMenuToggle}
        aria-expanded={isMobileMenuOpen}
        aria-controls={mobileMenuId}
        onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {isMobileMenuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
        <span>{isMobileMenuOpen ? "Close menu" : "Menu"}</span>
      </button>
      <nav
        id={mobileMenuId}
        className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ""}`}
        aria-label="Membership and reservations"
        hidden={!isMobileMenuOpen}
      >
        {NAV_ITEMS.filter((item) => item.href === "/membership" || item.href === "/reservations").map((item) => {
          const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={styles.userBlock}>
        <div className={styles.avatar} aria-hidden="true">
          <PersonIcon />
        </div>
        <div>
          <p className={styles.userName}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
          </p>
          {user?.memberSince && (
            <p className={styles.userMeta}>Member since {user.memberSince}</p>
          )}
        </div>
      </div>

      <nav className={styles.nav} aria-label="Your account">
        {NAV_ITEMS.map((item) => {
          const isActive = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${styles.accountNavItem} ${isActive ? styles.navItemActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>
                {item.href === "/account" ? "Account" : item.href === "/membership" ? "Membership" : item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav className={styles.serviceNav} aria-label="Explore the studio">
        {SERVICE_ITEMS.map((item) => {
          const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href}
            className={`${styles.navItem} ${styles.serviceNavItem} ${isActive ? styles.navItemActive : ""}`}
            aria-current={isActive ? "page" : undefined}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>;
        })}
      </nav>

      <div className={styles.footer}>
        <Link href="/contact" className={styles.navItem}>
          <span className={styles.navIcon}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </span>
          Contact Us
        </Link>

        <button type="button" className={`${styles.logoutBtn} ${styles.logoutNavItem}`} onClick={handleLogout}>
          <span className={styles.navIcon}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          Log Out
        </button>
      </div>
    </aside>
  );
}
