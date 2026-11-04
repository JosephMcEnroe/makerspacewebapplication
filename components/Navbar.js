import Link from "next/link";
import Image from "next/image";
import { useAuthContext } from "@/context/AuthContext";
import WaiverBanner from "@/components/WaiverBanner";
import styles from "./Navbar.module.css";

export default function Navbar({ hasSidebar = false }) {
  const { user } = useAuthContext();
  // Instructors get their own dashboard and the dark studio header; everyone
  // else lands on the member dashboard with the white one
  const isInstructor = Boolean(user?.isInstructor);
  const homeHref = isInstructor ? "/instructor" : "/dashboard";
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.charAt(0).toUpperCase() || "")
    .join("");

  return (
    <>
    <header className={`${styles.navbar} ${isInstructor ? styles.navbarInstructor : ""} ${hasSidebar ? styles.navbarWithSidebar : ""}`}>
      <Link href={homeHref} className={`${styles.brand} ${isInstructor ? styles.brandInstructor : ""}`}>
        {isInstructor
          ? "Crafty Studio"
          : (
            <Image
              src="/images/collaboratory_logo.jpg"
              alt="The Collaboratory"
              width={670}
              height={670}
              className={styles.brandLogo}
              priority
            />
          )}
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
    <WaiverBanner />
    </>
  );
}

