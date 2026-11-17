import ResourceCard from "./ResourceCard";

// Equipment that comes from the Stripe catalog shows its price in the corner pill
function priceLabel(product) {
  const amount = product.priceAmountFormatted;
  if (amount === null || amount === undefined) return null;

  const symbol = !product.currency || product.currency === "usd"
    ? "$"
    : `${product.currency.toUpperCase()} `;
  const suffix = product.default_price?.recurring
    ? ""
    : product.metadata?.room_id
      ? " / month"
      : " / hour";

  return `${symbol}${amount.toFixed(2)}${suffix}`;
}

export default function ReservationProductCard({ onSelect, ...resource }) {
  if (!resource.product) {
    return <ResourceCard {...resource} onSelect={onSelect} />;
  }

  const { product } = resource;
  const canBook =
    product.active === true &&
    product.default_price?.active === true &&
    Boolean(product.priceId);

  return (
    <ResourceCard
      {...resource}
      price={priceLabel(product)}
      onSelect={canBook ? onSelect : undefined}
    />
  );
}
