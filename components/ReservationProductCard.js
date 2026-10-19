import StripeProductCard from "./StripeProductCard";
import ResourceCard from "./ResourceCard";

export default function ReservationProductCard({ onSelect, ...resource }) {
  if (!resource.product) return <ResourceCard {...resource} onSelect={onSelect} />;
  return <StripeProductCard product={resource.product} actionLabel="Reserve" wholeCard disabled={resource.unavailable || !onSelect}
    priceSuffix={resource.product.default_price?.recurring ? "" : resource.product.metadata?.room_id ? " / month" : " / hour"}
    onCheckout={() => onSelect?.()} />;
}
