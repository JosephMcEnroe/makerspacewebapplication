import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  {
    label: "Account Information",
    href: "/account",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "Membership Management",
    href: "/membership",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
];

export default function Sidebar({ user = { name: "Alex Chen", memberSince: "2025" } }) {
  const router = useRouter();
  const initial = user.name?.charAt(0) ?? "?";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.userBlock}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
        </div>
        <div>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.userMeta}>Member since {user.memberSince}</p>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <Link href="/contact" className={styles.navItem}>
          <span className={styles.navIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </span>
          Contact Us
        </Link>
      </div>
    </aside>
  );
}
