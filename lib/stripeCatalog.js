import Stripe from "stripe";

export function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

export async function loadStripeProducts() {
  const products = [];
  for await (const product of getStripe().products.list({ active: true, limit: 100, expand: ["data.default_price"] })) {
    const price = product.default_price;
    products.push({ ...product, image: product.images?.[0] || null,
      priceId: price?.id || null, priceAmountFormatted: price?.unit_amount == null ? null : price.unit_amount / 100,
      currency: price?.currency || null });
  }
  return products;
}

export function matchResourceProduct(products, type, key) {
  const field = type === "rooms" ? "room_id" : "equipment_id";
  const matches = products.filter(p => key && p.metadata?.[field] === key);
  if (matches.length !== 1) throw new Error(`Expected one active Stripe product for ${field}: ${key || "unconfigured"}.`);
  const product = matches[0];
  const price = product.default_price;
  if (!price?.active || price.type !== "one_time" || price.billing_scheme !== "per_unit" || price.unit_amount == null || price.transform_quantity) {
    throw new Error(`Configure an active, fixed one-time default price for ${product.name}.`);
  }
  return product;
}
