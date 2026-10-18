import styles from "@/styles/StripeCheckout.module.css";

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


export default function StripeProductCard({ product, loadingPriceId = null, onCheckout, actionLabel = "Checkout", disabled = false, priceSuffix = "", wholeCard = false }) {
  const displayPrice = formatPrice(product);
  const imageUrl = product.image || product.images?.[0];
  const isProcessing = loadingPriceId === product.priceId;
  const canCheckout = product.active === true && product.default_price?.active === true;
  const canActivate = !disabled && canCheckout && !!product.priceId && loadingPriceId === null;
  const activate = () => {
    if (canActivate) onCheckout?.(product.priceId);
  };
  return (
    <div
      className={`${styles.card} ${wholeCard ? canActivate ? styles.cardInteractive : styles.cardDisabled : ""}`}
      role={wholeCard ? "button" : undefined}
      tabIndex={wholeCard ? canActivate ? 0 : -1 : undefined}
      aria-label={wholeCard ? `${actionLabel} ${product.name}` : undefined}
      aria-disabled={wholeCard ? !canActivate : undefined}
      onClick={wholeCard ? activate : undefined}
      onKeyDown={wholeCard ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      } : undefined}
    >
      <div className={styles.imageWrapper}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
            {displayPrice}{priceSuffix}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <h2 className={styles.productName}>{product.name}</h2>

        <p className={styles.productDescription}>
          {product.description || "Everything you need to bring your next idea to life."}
        </p>

        {wholeCard ? (!canActivate && <p className={styles.noPriceNote}>Currently unavailable</p>) : <div className={styles.cardFooter}>
          {product.priceId ? (
            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={() => onCheckout(product.priceId)}
              disabled={disabled || loadingPriceId !== null || !canCheckout}
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
                  {canCheckout && !disabled ? actionLabel : "Currently unavailable"}
                </>
              )}
            </button>
          ) : (
            <div className={styles.noPriceNote}>
              No default price assigned in Stripe
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
