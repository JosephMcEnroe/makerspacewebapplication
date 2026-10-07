function isMonthlyPrice(price) {
  return price?.type === "recurring" && price.recurring?.interval === "month" && price.recurring.interval_count === 1;
}

export function selectMembershipProducts(products) {
  const categoryOrder = { monthly: 0, day_pass: 1 };
  return products.filter((product) => {
    const price = product.default_price;
    if (product.active !== true || !price || typeof price !== "object" || price.active !== true) return false;
    const type = product.metadata?.membership_type;
    return (type === "monthly" && isMonthlyPrice(price)) || (type === "day_pass" && price.type === "one_time");
  }).sort((a, b) =>
    categoryOrder[a.metadata.membership_type] - categoryOrder[b.metadata.membership_type] ||
    (a.name || "").localeCompare(b.name || "", "en") || a.id.localeCompare(b.id, "en")
  );
}

export function getMonthlyMembershipProduct(products) {
  const monthlyProducts = selectMembershipProducts(products).filter((product) => product.metadata.membership_type === "monthly");
  return monthlyProducts.length === 1 ? monthlyProducts[0] : null;
}

export function hasMembershipOptions(products) {
  const eligible = selectMembershipProducts(products);
  return ["monthly", "day_pass"].every((type) => eligible.some((product) => product.metadata.membership_type === type));
}

export function getMonthlyMembershipCost(product) {
  const price = product?.default_price;
  if (!isMonthlyPrice(price)) {
    return null;
  }
  return Number.isFinite(product.priceAmountFormatted) ? product.priceAmountFormatted : null;
}
