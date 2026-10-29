import PDFDocument from "pdfkit";

export function renderFinancialReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 44, bufferPages: true,
      info: { Title: "Crafty Studio Financial Report", Author: "Crafty Studio" } });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      const width = 524;
      const colors = { primary: "#2b1916", accent: "#f0a752", cream: "#fbe8c3", muted: "#905e49", line: "#e8d6c5", red: "#b42318" };
      const money = (amount, currency) => {
        const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
        // Stripe's legacy ISK/UGX representation still uses two decimal places.
        const digits = ["isk", "ugx"].includes(currency) ? 2 : formatter.resolvedOptions().maximumFractionDigits;
        return formatter.format((amount || 0) / 10 ** digits);
      };
      const safe = value => String(value).replace(/[^\x20-\x7E\n]/g, "-");
      const textOf = value => typeof value === "object" ? value.text : value;
      const amountCell = (value, currency) => ({ text: money(value, currency), color: value < 0 ? colors.red : colors.primary });
      const heading = title => {
        if (doc.y > 648) doc.addPage();
        doc.moveDown(0.6).font("Helvetica-Bold").fontSize(13).fillColor(colors.primary).text(title).moveDown(0.4);
      };
      function table(headers, rows, widths) {
        function row(values, header = false) {
          doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
          const height = Math.max(...values.map((v, i) => doc.heightOfString(safe(textOf(v)), { width: widths[i] - 12 }))) + 12;
          if (doc.y + height > 728) { doc.addPage(); drawHeader(); }
          doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
          const y = doc.y;
          if (header) doc.rect(44, y, width, height).fill(colors.cream);
          let x = 44;
          values.forEach((value, i) => {
            doc.fillColor(value.color || colors.primary).text(safe(textOf(value)), x + 6, y + 6, { width: widths[i] - 12 });
            x += widths[i];
          });
          doc.y = y + height;
          doc.moveTo(44, doc.y).lineTo(568, doc.y).strokeColor(colors.line).stroke();
          doc.x = 44;
        }
        function drawHeader() { row(headers, true); }
        drawHeader();
        for (const values of rows) row(values);
        doc.moveDown(0.5);
      }
      doc.rect(0, 0, 612, 112).fill(colors.primary);
      doc.rect(0, 112, 612, 5).fill(colors.accent);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(colors.accent).text("CRAFTY STUDIO", 44, 27);
      doc.fontSize(25).fillColor("#ffffff").text("Financial report", 44, 47);
      doc.font("Helvetica").fontSize(9).fillColor(colors.cream).text(`${report.mode.toUpperCase()} mode | ${report.period.start} through ${report.period.end}`, 44, 83);
      doc.x = 44; doc.y = 132;
      doc.font("Helvetica").fontSize(9).fillColor(colors.muted)
        .text(`Timezone: ${report.period.timezone} | Weeks: Sunday - Saturday`)
        .text(`Generated: ${new Date(report.period.generatedAt).toLocaleString("en-US", { timeZone: report.period.timezone })} (Eastern)`)
        .moveDown(0.5).text("Financial activity is reported by payment date. Hours and months reflect purchased billing units.", { width });
      for (const s of report.currencies) {
        const m = value => amountCell(value, s.currency);
        heading(`${s.currency.toUpperCase()} summary`);
        table(["Financial activity", "Amount"], [
          ["Payments collected (includes tax)", m(s.totals.collected)],
          ["Total revenue (excludes tax)", m(s.totals.revenue ?? s.totals.collected - s.taxes)],
          ["Refunds / refund reversals", m(s.totals.refunds)],
          ["Disputes / dispute reversals", m(s.totals.disputes)],
          ["Stripe fees", m(-s.totals.fees)],
          ["Other adjustments (signed)", m(s.totals.other)],
          ["Net activity excluding payouts", m(s.totals.netPaymentActivity)],
          ["Payout balance movements (negative = sent to bank)", m(s.totals.payouts)],
          ["Total Stripe balance change", m(s.totals.balanceChange)],
          ["Recorded discounts (informational)", m(-s.discounts)],
          ["Tax collected (excluded from revenue)", m(s.taxes)],
        ], [370, 154]);
        heading("Sales by product type");
        table(["Product type", "Purchased units", "Collected", "Refunds", "Disputes"], s.sales.length ? s.sales.map(r => [
          r.type, `${Number(r.quantity.toFixed(2))} ${r.unit}`, m(r.collected), m(r.refunds), m(r.disputes),
        ]) : [["No financial sales activity", "-", m(0), m(0), m(0)]], [180, 95, 83, 83, 83]);
        heading("Machine activity");
        table(["Machine type", "Reservations\n(checkouts)", "Hours booked", "Fee", "Net"], s.machines?.length ? s.machines.map(r => [
          r.type, String(r.reservations), String(Number(r.hours.toFixed(2))), m(r.fee), m(r.net),
        ]) : [["No machine activity", "0", "0", m(0), m(0)]], [180, 100, 90, 77, 77]);
      }
      heading("Reporting notes");
      doc.font("Helvetica").fontSize(8).fillColor(colors.muted).text("Reservations count distinct paid checkouts per machine type. All database machine types are listed. Hours are purchased hours, including future bookings. Total revenue excludes recorded sales tax; collected amounts and Stripe cash net include tax. Machine net includes linked refunds, disputes, and allocated transaction fees; standalone account fees remain in the summary. Mixed-purchase fees are allocated proportionally. Refund and fee reversals retain their actual signs. This is not a profit statement; payouts are separate from sales.");
      for (const warning of report.warnings) doc.moveDown(0.5).text(safe(warning));
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(44, 744).lineTo(568, 744).strokeColor(colors.accent).stroke();
        doc.font("Helvetica").fontSize(8).fillColor(colors.muted).text(`Crafty Studio | Page ${i + 1} of ${range.count}`, 44, 752, { width, lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
