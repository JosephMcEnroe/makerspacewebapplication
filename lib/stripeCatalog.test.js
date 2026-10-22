import { describe, expect, it } from "vitest";
import { matchResourceProduct } from "./stripeCatalog";

const product = { id: "prod_account_specific", metadata: { equipment_id: "small_cnc" }, name: "Any display name",
  default_price: { id: "price_account_specific", active: true, type: "one_time", billing_scheme: "per_unit", unit_amount: 1000 } };

describe("Stripe resource metadata matching", () => {
  it("matches by metadata rather than account IDs or names", () => {
    expect(matchResourceProduct([product], "equipment", "small_cnc")).toBe(product);
  });
  it("keeps room and equipment metadata separate", () => {
    expect(() => matchResourceProduct([product], "rooms", "small_cnc")).toThrow();
    const room = { ...product, metadata: { room_id: "large_studio" } };
    expect(matchResourceProduct([room], "rooms", "large_studio")).toBe(room);
  });
  it("rejects missing and ambiguous mappings", () => {
    expect(() => matchResourceProduct([product], "equipment", null)).toThrow();
    expect(() => matchResourceProduct([product, product], "equipment", "small_cnc")).toThrow();
  });
  it.each([{ active: false }, { type: "recurring" }, { unit_amount: null }, { transform_quantity: { divide_by: 2 } }])("rejects incompatible prices %j", change => {
    expect(() => matchResourceProduct([{ ...product, default_price: { ...product.default_price, ...change } }], "equipment", "small_cnc")).toThrow();
  });
});
