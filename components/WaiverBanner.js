import Link from "next/link";
import { useRouter } from "next/router";
import { useAuthContext } from "@/context/AuthContext";
import styles from "./WaiverBanner.module.css";

// Shown under the navbar until the signed-in user completes their waiver
export default function WaiverBanner() {
  const { user } = useAuthContext();
  const router = useRouter();
  if (!user || user.waiverSigned !== false) return null;

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        <strong>Waiver required.</strong> Complete your liability waiver before using the studio.
      </p>
      {/* On /account the waiver card is already on the page, so just scroll to it */}
      <Link href={router.pathname === "/account" ? "#waiver" : "/account#waiver"} className={styles.link}>
        Complete Waiver
      </Link>
    </div>
  );
}
