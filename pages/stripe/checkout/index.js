import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import StripeProductCard from "@/components/StripeProductCard";
import styles from "@/styles/StripeCheckout.module.css";

export default function StripeCheckoutPage() {
  const router = useRouter();
  const { canceled } = router.query;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingPriceId, setLoadingPriceId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load products");
        }

        setProducts(data.products || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const handleCheckout = async (priceId) => {
    if (!priceId) return;

    setLoadingPriceId(priceId);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/create-product-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Forward user to Stripe Hosted Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout redirection error:", err);
      setCheckoutError(err.message || "An error occurred while redirecting to checkout.");
      setLoadingPriceId(null);
    }
  };


  return (
    <>
      <Head>
        <title>Product Checkout - The Crafty Studio</title>
        <meta name="description" content="Browse products and checkout at The Crafty Studio" />
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
          <Link href="/stripe" className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Stripe Debugging
          </Link>
          <h1 className={styles.title}>Product Checkout</h1>
          <p className={styles.subtitle}>
            Choose a product and continue to checkout.
          </p>
        </div>

        {canceled && (
          <div className={`${styles.noticeBanner} ${styles.cancelBanner}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Order checkout was canceled. You can continue browsing below whenever you&apos;re ready.</span>
          </div>
        )}

        {checkoutError && (
          <div className={`${styles.noticeBanner} ${styles.errorBanner}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{checkoutError}</span>
          </div>
        )}

        {loading && (
          <div className={styles.loadingContainer}>
            <p>Loading products from Stripe...</p>
          </div>
        )}

        {error && (
          <div className={`${styles.noticeBanner} ${styles.errorBanner}`}>
            <span>Failed to load products: {error}</span>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className={styles.emptyState}>
            <h3>No products found</h3>
            <p>No active Stripe products with default prices were detected in your connected account.</p>
          </div>
        )}

        <div className={styles.grid}>
          {products.map((product) => (
            <StripeProductCard key={product.id} product={product} loadingPriceId={loadingPriceId} onCheckout={handleCheckout} />
          ))}
        </div>
      </div>
    </>
  );
}
