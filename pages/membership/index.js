import Head from "next/head";
import { useEffect, useState } from "react";
import MembershipCard from "@/components/MembershipCard";
import StripeProductCard from "@/components/StripeProductCard";
import productStyles from "@/styles/StripeCheckout.module.css";
import { selectMembershipProducts, getMonthlyMembershipProduct, getMonthlyMembershipCost, hasMembershipOptions } from "@/lib/membershipProducts";
import styles from "@/styles/Account.module.css";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { getSessionUser, loginRedirect } from "@/lib/session";
import { formatDate } from "@/lib/format";

export async function getServerSideProps({ req, resolvedUrl }) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return loginRedirect(resolvedUrl);
  }

  const membership = await new membershipRepositry().findUserMembership(sessionUser.user_id);

  return {
    props: {
      membership: {
        planName: sessionUser.first_name ? `${sessionUser.first_name}'s Membership` : "Membership",
        status: (membership?.status ?? "").toLowerCase(),
        monthlyCost: null,
        nextBillingDate: formatDate(membership?.period_end_date),
      },
    },
  };
}

export default function MembershipPage({ membership }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingPriceId, setLoadingPriceId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const active = membership.status === "active";

  useEffect(() => {
    const controller = new AbortController();
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load membership options.");
        setProducts(selectMembershipProducts(data.products || []));
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadProducts();
    return () => controller.abort();
  }, []);

  async function handleCheckout(priceId) {
    if (!priceId || loadingPriceId !== null) return;
    setLoadingPriceId(priceId);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/create-product-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err.message);
      setLoadingPriceId(null);
    }
  }

  const monthlyProduct = getMonthlyMembershipProduct(products);
  const billingMembership = {
    ...membership,
    monthlyCost: getMonthlyMembershipCost(monthlyProduct),
    currency: monthlyProduct?.currency || "usd",
  };

  return (
    <>
      <Head>
        <title>Membership Management - The Crafty Studio</title>
        <meta name="description" content="Manage your Crafty Studio membership" />
      </Head>
      <h1 className={styles.title}>MEMBERSHIP MANAGEMENT</h1>
      {active && <MembershipCard membership={billingMembership} />}
      {loading && <p role="status">Loading membership prices...</p>}
      {error && <p role="alert" className={`${productStyles.noticeBanner} ${productStyles.errorBanner}`}>{error}</p>}
      {!active && (
        <>
          <p className={styles.subtitle}>Choose a monthly membership or a day pass.</p>
          {checkoutError && <p role="alert" className={`${productStyles.noticeBanner} ${productStyles.errorBanner}`}>{checkoutError}</p>}
          {!loading && !error && !hasMembershipOptions(products) && <p role="status">Some membership options are currently unavailable.</p>}
          <div className={styles.membershipGrid}>
            {products.map((product) => (
              <StripeProductCard key={product.id} product={product} loadingPriceId={loadingPriceId} onCheckout={handleCheckout} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
