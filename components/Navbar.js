import Link from "next/link";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user } = useAuthContext();
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.charAt(0).toUpperCase() || "")
    .join("");

  return (
    <header className={styles.navbar}>
      <Link href="/dashboard" className={styles.brand}>
        THE CRAFTY STUDIO
      </Link>

      <div className={styles.navRight}>
        <nav className={styles.navLinks}>
          <Link href="/rooms" className={styles.navLink}>
            ROOMS
          </Link>
          <Link href="/classes" className={styles.navLink}>
            CLASSES
          </Link>
          <Link href="/equipment" className={styles.navLink}>
            EQUIPMENT
          </Link>
        </nav>

        <Link href="/account" className={styles.avatar} aria-label="Account settings">
          {initials}
        </Link>
      </div>
    </header>
  );
}

