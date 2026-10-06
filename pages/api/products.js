import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const allProducts = [];

    for await (const product of stripe.products.list({
      limit: 100,
      expand: ["data.default_price"],
    })) {
      allProducts.push({
        // =========================
        // PRODUCT INFORMATION
        // =========================
        ...product,

        // =========================
        // DEFAULT PRICE
        // =========================
        default_price: product.default_price || null,

        // =========================
        // CONVENIENCE FIELDS
        // =========================
        priceId:
          product.default_price && typeof product.default_price !== "string"
            ? product.default_price.id
            : product.default_price || null,

        priceAmount:
          product.default_price &&
          typeof product.default_price !== "string"
            ? product.default_price.unit_amount
            : null,

        priceAmountFormatted:
          product.default_price &&
          typeof product.default_price !== "string" &&
          product.default_price.unit_amount !== null
            ? product.default_price.unit_amount / 100
            : null,

        currency:
          product.default_price &&
          typeof product.default_price !== "string"
            ? product.default_price.currency
            : null,

        // =========================
        // IMAGES
        // =========================
        images: product.images || [],

        // First image for easy frontend use
        image: product.images?.[0] || null,
      });
    }

    console.log("=== STRIPE PRODUCTS FOUND ===");
    console.dir(allProducts, { depth: null });
    console.log("=============================");

    return res.status(200).json({
      products: allProducts,
      count: allProducts.length,
    });
  } catch (error) {
    console.error("Stripe error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
}