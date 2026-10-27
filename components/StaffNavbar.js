import Link from "next/link";
import { useRouter } from "next/router";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./StaffNavbar.module.css";

const NAV_ITEMS = (role) => [
  { label: "Dashboard", href: `/${role}` },
  { label: "Members", href: "/members" },
  { label: "Equipment", href: "/equipment" },
];

export default function StaffNavbar({ role = "staff" }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.charAt(0).toUpperCase() || "")
    .join("");
  const navItems = NAV_ITEMS(role);

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <Link href={`/${role}`} className={styles.brand}>
          Crafty Studio
        </Link>
        <span className={styles.rolePill}>{role}</span>
      </div>

      <div className={styles.navRight}>
        <nav className={styles.navLinks}>
          {navItems.map((item) => {
            const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
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
      </div>
    </header>
  );
}
