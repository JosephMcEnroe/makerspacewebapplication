import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "@/styles/ProductDemo.module.css";

export default function ProductDemoPage() {
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

  const formatPrice = (product) => {
    if (product.priceAmountFormatted === null || product.priceAmountFormatted === undefined) {
      return null;
    }

    const currencySymbol = product.currency === "usd" || !product.currency ? "$" : `${product.currency.toUpperCase()} `;
    const priceString = `${currencySymbol}${product.priceAmountFormatted.toFixed(2)}`;

    if (product.default_price?.recurring) {
      const interval = product.default_price.recurring.interval || "mo";
      return `${priceString}/${interval}`;
    }

    return priceString;
  };

  return (
    <>
      <Head>
        <title>Product Checkout Demo - The Crafty Studio</title>
        <meta name="description" content="Stripe Product Checkout showcase and test catalog" />
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
          <Link href="/debugging" className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Stripe Debugging
          </Link>
          <h1 className={styles.title}>Product Showcase & Checkout</h1>
          <p className={styles.subtitle}>
            Live catalog fetched directly from your Stripe products. Select an item to test the complete Stripe Checkout flow.
          </p>
        </div>

        {canceled && (
          <div className={`${styles.noticeBanner} ${styles.cancelBanner}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Order checkout was canceled. You can continue browsing below whenever you're ready.</span>
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
          {products.map((product) => {
            const displayPrice = formatPrice(product);
            const imageUrl = product.image || product.images?.[0];
            const isProcessing = loadingPriceId === product.priceId;

            return (
              <div key={product.id} className={styles.card}>
                <div className={styles.imageWrapper}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className={styles.image}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.imageFallback}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                      <span>No image available</span>
                    </div>
                  )}

                  {displayPrice && (
                    <div className={styles.priceTag}>
                      {displayPrice}
                    </div>
                  )}
                </div>

                <div className={styles.body}>
                  <h2 className={styles.productName}>{product.name}</h2>

                  <p className={styles.productDescription}>
                    {product.description || "Crafty Studio makerspace resource and materials."}
                  </p>

                  <div className={styles.cardFooter}>
                    {product.priceId ? (
                      <button
                        type="button"
                        className={styles.checkoutBtn}
                        onClick={() => handleCheckout(product.priceId)}
                        disabled={loadingPriceId !== null}
                      >
                        {isProcessing ? (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Redirecting to Stripe...
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            Checkout with Stripe
                          </>
                        )}
                      </button>
                    ) : (
                      <div className={styles.noPriceNote}>
                        No default price assigned in Stripe
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
