import ExcelJS from "exceljs";
import { currencyAmount, currencyDigits } from "./reportCurrency";

import { reportingNotes } from "./reportNotes";

function tables(report) {
  const summary = [], sales = [], machines = [], transactions = [];
  for (const s of report.currencies) {
    const currency = s.currency.toUpperCase();
    const amount = value => currencyAmount(value, s.currency);
    const metrics = [
      ["Payments collected (includes tax)", s.totals.collected],
      ["Total revenue (excludes tax)", s.totals.revenue ?? s.totals.collected - s.taxes],
      ["Refunds / refund reversals", s.totals.refunds],
      ["Disputes / dispute reversals", s.totals.disputes],
      ["Stripe fees", -s.totals.fees],
      ["Other adjustments (signed)", s.totals.other],
      ["Net activity excluding payouts", s.totals.netPaymentActivity],
      ["Payout balance movements (negative = sent to bank)", s.totals.payouts],
      ["Total Stripe balance change", s.totals.balanceChange],
      ["Recorded discounts (informational)", -s.discounts],
      ["Tax collected (excluded from revenue)", s.taxes],
    ];
    summary.push(...metrics.map(([label, value]) => [currency, label, amount(value)]));
    sales.push(...s.sales.map(r => [currency, r.productId, r.group, r.type, r.quantity, r.unit, amount(r.collected), amount(r.refunds), amount(r.disputes)]));
    machines.push(...(s.machines ?? []).map(r => [currency, r.type, r.reservations, r.hours, amount(r.fee), amount(r.net)]));
    transactions.push(...s.transactions.map(r => [currency, r.id, r.source, new Date(r.created * 1000).toISOString(), r.category, r.description, amount(r.amount), amount(r.fee), amount(r.net)]));
  }
  return [
    { name: "Metadata", headers: ["Property", "Value"], rows: [
      ["Report", "Crafty Studio Financial Report"], ["Mode", report.mode],
      ["Start date", report.period.start], ["End date", report.period.end],
      ["Timezone", report.period.timezone], ["Generated at", report.period.generatedAt],
      ["Date basis", "Payment activity; weeks run Sunday through Saturday"],
      ["Amounts", "Major currency units; currencies are reported separately"],
    ] },
    { name: "Summary", headers: ["Currency", "Financial activity", "Amount"], rows: summary, money: [3] },
    { name: "Product sales", headers: ["Currency", "Product ID", "Group", "Product type", "Purchased quantity", "Unit", "Collected", "Refunds", "Disputes"], rows: sales, money: [7, 8, 9] },
    { name: "Machine activity", headers: ["Currency", "Machine type", "Reservations (checkouts)", "Hours booked", "Fee", "Net"], rows: machines, money: [5, 6] },
    { name: "Transactions", headers: ["Currency", "Transaction ID", "Source ID", "Created (UTC)", "Category", "Description", "Amount", "Fee", "Net"], rows: transactions, money: [7, 8, 9] },
    { name: "Reporting notes", headers: ["Type", "Note"], rows: [["Note", reportingNotes], ...report.warnings.map(warning => ["Warning", warning])] },
  ];
}

function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderFinancialReportCsv(report) {
  const multipleCurrencies = new Set(report.currencies.map(section => section.currency)).size > 1;
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: report.period.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const transactions = report.currencies.flatMap(section =>
    section.transactions.map(transaction => ({ ...transaction, currency: section.currency }))
  ).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  const rows = [multipleCurrencies ? "Date,Description,Amount,Currency" : "Date,Description,Amount"];
  for (const transaction of transactions) {
    const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(transaction.created * 1000)).map(({ type, value }) => [type, value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const description = transaction.description?.trim() || transaction.category || transaction.id;
    // Amount is signed gross transaction activity, before Stripe fees.
    // Serialize trusted numeric amounts separately so negative values stay numeric.
    const amount = currencyAmount(transaction.amount, transaction.currency).toFixed(currencyDigits(transaction.currency));
    const row = [date, csvCell(description), amount];
    if (multipleCurrencies) row.push(csvCell(transaction.currency.toUpperCase()));
    rows.push(row.join(","));
  }
  return Buffer.from(`\uFEFF${rows.join("\r\n")}\r\n`, "utf8");
}

export async function renderFinancialReportXlsx(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Crafty Studio";
  for (const table of tables(report)) {
    const sheet = workbook.addWorksheet(table.name);
    sheet.addRows([table.headers, ...table.rows]);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach(column => { column.width = 26; });
    for (let index = 0; index < table.rows.length; index++) {
      for (const column of table.money ?? []) {
        const digits = currencyDigits(table.rows[index][0]);
        sheet.getCell(index + 2, column).numFmt = digits ? `#,##0.${"0".repeat(digits)}` : "#,##0";
      }
    }
    if (table.name === "Reporting notes") {
      sheet.getColumn(2).width = 100;
      sheet.getColumn(2).alignment = { wrapText: true, vertical: "top" };
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
