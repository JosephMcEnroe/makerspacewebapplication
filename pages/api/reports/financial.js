import Stripe from "stripe";
import { getStaffSession } from "@/lib/staffAuth";
import { resolveReportPeriod } from "@/lib/reports/reportPeriod";
import { buildFinancialReport } from "@/lib/reports/stripeFinancialReport";
import { renderFinancialReportPdf } from "@/lib/reports/financialReportPdf";
import { loadReportMappings } from "@/Data_Access_Layer/reportRepository";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  try {
    const session = await getStaffSession(req);
    if (!session) return res.status(401).json({ error: "Sign in to continue." });
    if (!session.isAdmin) return res.status(403).json({ error: "Admin access required." });
    let period;
    try { period = resolveReportPeriod(req.query); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 20000, maxNetworkRetries: 1 });
    const mappings = await loadReportMappings();
    const report = await buildFinancialReport({ stripe, mappings, period,
      mode: process.env.STRIPE_SECRET_KEY.includes("_test_") ? "test" : "live" });
    const pdf = await renderFinancialReportPdf(report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="financial-report_${period.start}_${period.end}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Financial report generation failed:", error.type || error.name);
    return res.status(500).json({ error: "Unable to generate the complete report. Please try again or contact your administrator." });
  }
}
