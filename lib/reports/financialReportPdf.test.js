import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { renderFinancialReportPdf } from "./financialReportPdf";

function report(count) {
  return { mode: "test", period: { start: "2026-10-01", end: "2026-10-28", timezone: "America/New_York", generatedAt: "2026-10-28T12:00:00Z" }, warnings: [],
    currencies: [{ currency: "usd", discounts: 0, taxes: 0, machines: [], sales: Array.from({ length: count }, (_, i) => ({
      type: `Machine ${i}`, quantity: 1, unit: "hours", collected: 1200, refunds: -100, disputes: 0 })),
      totals: { collected: 1200 * count, refunds: 0, disputes: 0, fees: 65 * count, other: 0, netPaymentActivity: 1135 * count, payouts: 0, balanceChange: 1135 * count },
      transactions: Array.from({ length: count }, (_, i) => ({ id: `txn_${i}`, source: `ch_${i}`, created: 1791800000,
        category: "charge", description: "Machine reservations: Small CNC", amount: 1200, fee: 65, net: 1135 })) }] };
}
function contentStreams(pdf) {
  const raw = pdf.toString("latin1");
  return [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => inflateSync(Buffer.from(match[1], "latin1")).toString()).join("\n");
}
describe("financial PDF rendering", () => {
  it("renders an empty period as a complete PDF", async () => {
    const pdf = await renderFinancialReportPdf(report(0));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("%%EOF");
  });
  it("paginates long product tables without an appendix and retains the final type", async () => {
    const pdf = await renderFinancialReportPdf(report(120));
    const pages = [...pdf.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
    expect(pages).toBeGreaterThan(4);
    const content = [...contentStreams(pdf).matchAll(/<([0-9a-f]+)>/gi)].map(match => Buffer.from(match[1], "hex").toString()).join("");
    expect(content.includes("Machine 119")).toBe(true);
    expect(content.includes("Transaction appendix")).toBe(false);
    expect(content.includes(`Page ${pages} of ${pages}`)).toBe(true);
    expect([...content.matchAll(/Page \d+ of \d+/g)]).toHaveLength(pages);
  });
  it("shows machine checkouts, negative fees and refunds, and brand colors", async () => {
    const data = report(1);
    data.currencies[0].machines = [{ type: "Small CNC", reservations: 2, hours: 3, fee: -65, net: 1135 }];
    const pdf = await renderFinancialReportPdf(data);
    const stream = contentStreams(pdf);
    const text = [...stream.matchAll(/<([0-9a-f]+)>/gi)].map(match => Buffer.from(match[1], "hex").toString()).join("");
    expect(text.includes("-$0.65")).toBe(true);
    expect(text.includes("-$1.00")).toBe(true);
    expect(text.includes("Machine reservations")).toBe(false);
    expect(text.includes("Machine activity")).toBe(true);
    expect(text.includes("checkouts")).toBe(true);
    expect(stream.includes("0.7058823529411765 0.13725490196078433 0.09411764705882353 scn")).toBe(true);
    expect(stream.includes("0.16862745098039217 0.09803921568627451 0.08627450980392157 scn")).toBe(true);
  });
});
