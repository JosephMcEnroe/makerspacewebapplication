import Link from "next/link";
import Image from "next/image";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar({ hasSidebar = false }) {
  const { user } = useAuthContext();
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.charAt(0).toUpperCase() || "")
    .join("");

  return (
    <header className={`${styles.navbar} ${hasSidebar ? styles.navbarWithSidebar : ""}`}>
      <Link href="/dashboard" className={styles.brand}>
        <Image
          src="/images/collaboratory_logo.jpg"
          alt="The Collaboratory"
          width={670}
          height={670}
          className={styles.brandLogo}
          priority
        />
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

