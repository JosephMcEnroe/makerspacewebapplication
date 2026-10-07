export const MEMBERSHIP_PRODUCT_ID = "prod_VJDhlzwaP4CHLQ";
export const DAY_PASS_PRODUCT_ID = "prod_VJDhczYiFDf7dD";

export function selectMembershipProducts(products) {
  return [MEMBERSHIP_PRODUCT_ID, DAY_PASS_PRODUCT_ID]
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
}

export function getMonthlyMembershipCost(product) {
  const price = product?.default_price;
  if (!price || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
    return null;
  }
  return Number.isFinite(product.priceAmountFormatted) ? product.priceAmountFormatted : null;
}
