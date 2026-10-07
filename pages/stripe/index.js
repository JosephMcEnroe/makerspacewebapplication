import { useEffect, useState } from "react";
import Link from "next/link";

export default function Debugging() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");

        const text = await response.text();

        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `API did not return JSON. Status: ${response.status}\n\n${text}`
          );
        }

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

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Stripe Debugging</h1>
        <Link href="/stripe/reports">View Stripe Reports &rarr;</Link>
        <p>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Stripe Debugging</h1>
        <Link href="/stripe/reports">View Stripe Reports &rarr;</Link>

        <h2>Error</h2>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f5f5f5",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Stripe Debugging</h1>

      <Link
        href="/stripe/reports"
        style={{ display: "inline-block", padding: "12px 24px", backgroundColor: "#2b1916", color: "#fff", borderRadius: "8px", textDecoration: "none", fontWeight: "bold" }}
      >
        View Stripe Reports &rarr;
      </Link>

      <div style={{ margin: "20px 0 30px" }}>
        <Link
          href="/stripe/checkout"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#2b1916",
            color: "#ffffff",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          🎨 View Product Checkout &rarr;
        </Link>
      </div>

      <p>
        <strong>{products.length}</strong> product
        {products.length !== 1 ? "s" : ""} found.
      </p>

      {products.length === 0 && (
        <p>No Stripe products were found.</p>
      )}

      {products.map((product) => (
        <div
          key={product.id}
          style={{
            border: "1px solid #ccc",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "30px",
          }}
        >
          <h2>{product.name}</h2>

          {product.description && (
            <p>{product.description}</p>
          )}

          {/* ========================= */}
          {/* PRODUCT IMAGES */}
          {/* ========================= */}

          <h3>Images</h3>

          {product.images && product.images.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "15px",
                marginBottom: "20px",
              }}
            >
              {product.images.map((image, index) => (
                <div key={index}>
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    style={{
                      width: "250px",
                      height: "250px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                    }}
                  />

                  <p
                    style={{
                      fontSize: "12px",
                      maxWidth: "250px",
                      wordBreak: "break-all",
                    }}
                  >
                    {image}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>No images attached to this product.</p>
          )}

          {/* ========================= */}
          {/* BASIC PRODUCT DATA */}
          {/* ========================= */}

          <h3>Product Information</h3>

          <pre
            style={{
              background: "#f5f5f5",
              padding: "20px",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(
              {
                id: product.id,
                name: product.name,
                description: product.description,
                active: product.active,
                livemode: product.livemode,
                type: product.type,
                created: product.created,
                updated: product.updated,
                metadata: product.metadata,
                images: product.images,
                url: product.url,
              },
              null,
              2
            )}
          </pre>

          {/* ========================= */}
          {/* PRICE DATA */}
          {/* ========================= */}

          <h3>Price Information</h3>

          <pre
            style={{
              background: "#f5f5f5",
              padding: "20px",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(
              {
                priceId: product.priceId,
                priceAmount: product.priceAmount,
                priceAmountFormatted:
                  product.priceAmountFormatted,
                currency: product.currency,
                default_price: product.default_price,
              },
              null,
              2
            )}
          </pre>

          {/* ========================= */}
          {/* EVERYTHING */}
          {/* ========================= */}

          <details>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              Show Complete Stripe Product Data
            </summary>

            <pre
              style={{
                background: "#111",
                color: "#fff",
                padding: "20px",
                borderRadius: "8px",
                overflowX: "auto",
                marginTop: "15px",
              }}
            >
              {JSON.stringify(product, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
