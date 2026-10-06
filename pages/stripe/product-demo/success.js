import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "@/styles/ProductDemo.module.css";

export default function ProductCheckoutSuccess() {
  const router = useRouter();
  const { session_id } = router.query;

  return (
    <>
      <Head>
        <title>Payment Successful - The Crafty Studio</title>
        <meta name="description" content="Stripe checkout successful confirmation" />
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className={styles.successTitle}>Payment Successful!</h1>
          <p className={styles.successText}>
            Thank you for your order. Your Stripe payment has been confirmed and processed successfully.
          </p>

          {session_id && (
            <div className={styles.sessionBox}>
              <strong>Stripe Session ID:</strong>
              <div>{session_id}</div>
            </div>
          )}

          <div className={styles.actionRow}>
            <Link href="/stripe/product-demo" className={styles.checkoutBtn} style={{ textDecoration: "none" }}>
              Back to Products
            </Link>
            <Link href="/dashboard" className={styles.secondaryBtn}>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
