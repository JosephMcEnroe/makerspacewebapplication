import Link from "next/link";
import styles from "./Navbar.module.css";

export default function Navbar() {
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
          AC
        </Link>
      </div>
    </header>
  );
}

