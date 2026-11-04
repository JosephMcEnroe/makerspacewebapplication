import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("stripe", () => ({ default: class Stripe {} }));
vi.mock("@/lib/staffAuth", () => ({ getStaffSession: vi.fn() }));
vi.mock("@/Data_Access_Layer/reportRepository", () => ({ loadReportMappings: vi.fn() }));
vi.mock("@/lib/reports/stripeFinancialReport", () => ({ buildFinancialReport: vi.fn() }));
vi.mock("@/lib/reports/financialReportPdf", () => ({ renderFinancialReportPdf: vi.fn() }));
import handler from "@/pages/api/reports/financial";
import { getStaffSession } from "@/lib/staffAuth";
import { buildFinancialReport } from "@/lib/reports/stripeFinancialReport";
import { renderFinancialReportPdf } from "@/lib/reports/financialReportPdf";
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}
describe("financial PDF API", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    getStaffSession.mockResolvedValue({ isAdmin: true });
    buildFinancialReport.mockResolvedValue({}); renderFinancialReportPdf.mockResolvedValue(Buffer.from("%PDF-test"));
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requires GET", async () => {
    const res = response(); await handler({ method: "POST" }, res); expect(res.status).toHaveBeenCalledWith(405);
  });
  it.each([[null, 401], [{ isAdmin: false }, 403]])("requires admin access", async (session, code) => {
    getStaffSession.mockResolvedValue(session); const res = response();
    await handler({ method: "GET", query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(code); expect(buildFinancialReport).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges", async () => {
    const res = response(); await handler({ method: "GET", query: { start: "bad", end: "bad" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it("returns a noncached PDF attachment", async () => {
    const res = response(); await handler({ method: "GET", query: { start: "2026-01-01", end: "2026-01-02" } }, res);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="financial-report_2026-01-01_2026-01-02.pdf"');
    expect(res.send).toHaveBeenCalledWith(Buffer.from("%PDF-test"));
  });
  it("returns an error without PDF headers for upstream failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    buildFinancialReport.mockRejectedValue(new Error("secret upstream detail"));
    const res = response(); await handler({ method: "GET", query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).not.toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.json.mock.calls[0][0].error).not.toContain("secret upstream detail");
    vi.restoreAllMocks();
  });
});
