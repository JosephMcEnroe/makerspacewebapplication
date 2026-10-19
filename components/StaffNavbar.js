import Link from "next/link";
import { useRouter } from "next/router";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./StaffNavbar.module.css";

// Reports (Stripe revenue) is admin-only, so it's hidden when there's no href
const NAV_ITEMS = (role, reportsHref) => [
  { label: "Dashboard", href: `/${role}` },
  { label: "Members", href: "/members" },
  { label: "Equipment", href: "/equipment" },
  { label: "Reports", href: reportsHref },
].filter((item) => item.href);

export default function StaffNavbar({ role = "staff", reportsHref = role === "admin" ? "/stripe/reports" : null }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.charAt(0).toUpperCase() || "")
    .join("");
  const navItems = NAV_ITEMS(role, reportsHref);

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
    </header>
  );
}
