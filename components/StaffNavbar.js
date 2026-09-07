import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./StaffNavbar.module.css";

const NAV_ITEMS = (role) => [
  { label: "Dashboard", href: `/${role}` },
  { label: "Members", href: "/members" },
  { label: "Equipment", href: "/equipment" },
  { label: "Reports", href: "/reports" },
];

export default function StaffNavbar({ role = "staff", initials = "AC" }) {
  const router = useRouter();
  const navItems = NAV_ITEMS(role);

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <Link href={`/${role}`} className={styles.brand}>
          Crafty Studio
        </Link>
        <span className={styles.rolePill}>{role}</span>
      </div>

      <nav className={styles.navLinks}>
        {navItems.map((item) => {
          const isActive = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link href="/account" className={styles.avatar} aria-label="Account settings">
        {initials}
      </Link>
    </header>
  );
}
