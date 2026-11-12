import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { unzipSync } from "fflate";
import { exportFinancialReport, parseReportFormats } from "./financialReportExport";
import { renderFinancialReportCsv, renderFinancialReportXlsx } from "./financialReportSpreadsheet";
import { currencyAmount } from "./reportCurrency";

function fixture() {
  return { mode: "test", period: { start: "2026-01-01", end: "2026-01-02", timezone: "America/New_York", generatedAt: "2026-01-03T00:00:00Z" }, warnings: ["Missing details"],
    currencies: ["usd", "jpy", "kwd", "isk", "ugx"].map(currency => ({
      currency, taxes: 100, discounts: 50,
      totals: { collected: 1250, revenue: 1150, refunds: -100, disputes: 0, fees: 65, other: 0, netPaymentActivity: 1085, payouts: -500, balanceChange: 585 },
      sales: [{ productId: "p1", group: "Machines", type: "CNC", quantity: 1.25, unit: "hours", collected: 1250, refunds: -100, disputes: 0 }],
      machines: [{ type: "CNC", reservations: 1, hours: 1.25, fee: -65, net: 1085 }],
      transactions: [{ id: "txn1", source: "ch1", created: 1767225600, category: "charge", description: '=SUM(1,2)\n"quoted"', amount: 1250, fee: 65, net: 1185 }],
    })) };
}

describe("financial report exports", () => {
  it("defaults and deduplicates formats", () => {
    expect(parseReportFormats()).toEqual(["pdf"]);
    expect(parseReportFormats("pdf,csv,pdf")).toEqual(["pdf", "csv"]);
  });
  it.each(["pdf", "csv", "xlsx", "pdf,csv", "pdf,xlsx", "csv,xlsx", "pdf,csv,xlsx"])("generates valid files for %s", async selection => {
    const report = fixture(), formats = parseReportFormats(selection);
    const result = await exportFinancialReport(report, formats);
    const base = "financial-report_2026-01-01_2026-01-02";
    const files = formats.length > 1 ? unzipSync(result.data) : { [result.filename]: result.data };
    expect(Object.keys(files).sort()).toEqual(formats.map(f => `${base}.${f}`).sort());
    for (const format of formats) {
      const bytes = Buffer.from(files[`${base}.${format}`]);
      if (format === "pdf") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      if (format === "csv") expect(bytes.equals(renderFinancialReportCsv(report))).toBe(true);
      if (format === "xlsx") {
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
        expect(workbook.getWorksheet("Transactions").rowCount).toBe(6);
      }
    }
  });
  it("preserves numeric amounts, signs, precision, notes and worksheet structure", async () => {
    const report = fixture(), workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await renderFinancialReportXlsx(report));
    expect(workbook.worksheets.map(s => s.name)).toEqual(["Metadata", "Summary", "Product sales", "Machine activity", "Transactions", "Reporting notes"]);
    report.currencies.forEach((s, index) => {
      const row = workbook.getWorksheet("Transactions").getRow(index + 2);
      expect(row.getCell(7).value).toBe(currencyAmount(1250, s.currency));
      expect(row.getCell(6).type).toBe(ExcelJS.ValueType.String);
      expect(workbook.getWorksheet("Machine activity").getCell(index + 2, 5).value).toBe(currencyAmount(-65, s.currency));
      expect(workbook.getWorksheet("Summary").getCell(4 + index * 11, 3).value).toBe(currencyAmount(-100, s.currency));
    });
    expect(workbook.getWorksheet("Reporting notes").getCell("B3").value).toBe("Missing details");
    expect(workbook.getWorksheet("Summary").views[0].ySplit).toBe(1);
    expect(currencyAmount(1250, "jpy")).toBe(1250);
    expect(currencyAmount(1250, "kwd")).toBe(1.25);
    expect(currencyAmount(1250, "isk")).toBe(12.5);
  });
  it("escapes CSV and protects formula text without changing negative numbers", () => {
    const csv = renderFinancialReportCsv(fixture()).toString("utf8");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=SUM(1,2)\n""quoted"""');
    expect(csv).toContain("Date,Description,Amount,Currency\r\n");
    expect(csv).toContain(',12.50,USD');
    expect(csv).toContain(',1250,JPY');
    expect(csv).toContain(',1.250,KWD');
  });
  it("exports a single chronological transaction table in Eastern time", () => {
    const report = fixture(); report.currencies = [report.currencies[0]];
    report.currencies[0].transactions = [
      { id: "later", created: Date.parse("2026-10-03T12:00:00Z") / 1000, description: "Client Payment - Invoice 104", amount: 150000 },
      { id: "earlier", created: Date.parse("2026-10-03T02:00:00Z") / 1000, description: "Office Supplies Store", amount: -4550 },
      { id: "fallback", created: Date.parse("2026-10-04T12:00:00Z") / 1000, description: "", category: "payout", amount: -12045 },
    ];
    expect(renderFinancialReportCsv(report).toString()).toBe("\uFEFFDate,Description,Amount\r\n2026-10-02,Office Supplies Store,-45.50\r\n2026-10-03,Client Payment - Invoice 104,1500.00\r\n2026-10-04,payout,-120.45\r\n");
  });
  it("exports empty activity with headers and notes", async () => {
    const report = fixture(); report.currencies = [];
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await renderFinancialReportXlsx(report));
    expect(workbook.getWorksheet("Transactions").rowCount).toBe(1);
    expect(renderFinancialReportCsv(report).toString()).toBe("\uFEFFDate,Description,Amount\r\n");
  });
});
