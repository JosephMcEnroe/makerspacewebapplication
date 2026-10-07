import Head from "next/head";
import Link from "next/link";
import styles from "@/styles/StripeCheckout.module.css";

export default function ProductCheckoutSuccess() {
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
            Payment confirmed and processed successfully. Thank you for choosing Crafty Studio!
          </p>

          <div className={styles.actionRow}>
            <Link href="/dashboard" className={styles.checkoutBtn} style={{ textDecoration: "none" }}>
              View Available Equipment
            </Link>
            <Link href="/membership" className={styles.secondaryBtn}>
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
