import { describe, expect, it } from "vitest";
import { resolveReportPeriod } from "./reportPeriod";

describe("financial report periods", () => {
  it("starts weeks on Sunday and retains Saturday", () => {
    const saturday = resolveReportPeriod({ preset: "week_to_date" }, new Date("2026-10-25T03:59:59Z"));
    expect(saturday.start).toBe("2026-10-18");
    expect(saturday.end).toBe("2026-10-24");
    const sunday = resolveReportPeriod({ preset: "week_to_date" }, new Date("2026-10-25T04:00:00Z"));
    expect(sunday.start).toBe("2026-10-25");
    expect(sunday.startSeconds).toBe(sunday.endSeconds);
  });
  it("handles 23 and 25 hour Eastern days", () => {
    for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]]) {
      const period = resolveReportPeriod({ start: date, end: date }, new Date("2027-01-01T12:00:00Z"));
      expect(period.endSeconds - period.startSeconds).toBe(hours * 3600);
    }
  });
  it("handles previous month across years and defaults to this month", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(resolveReportPeriod({ preset: "previous_month" }, now)).toMatchObject({ start: "2025-12-01", end: "2025-12-31" });
    expect(resolveReportPeriod({}, now).start).toBe("2026-01-01");
  });
  it("rejects invalid, reversed, excessive, future, and repeated parameters", () => {
    for (const query of [
      { start: "2026-02-30", end: "2026-03-01" }, { start: "2026-03-02", end: "2026-03-01" },
      { start: "2024-01-01", end: "2026-01-01" }, { start: "2099-01-01", end: "2099-01-02" },
      { preset: ["today", "previous_month"] }, { start: "oops", end: "2026-03-01" },
    ]) expect(() => resolveReportPeriod(query)).toThrow();
  });
  it("caps an ongoing custom range at now", () => {
    const now = new Date("2026-10-28T18:10:00Z");
    const period = resolveReportPeriod({ start: "2026-10-01", end: "2026-11-01" }, now);
    expect(period.end).toBe("2026-10-28");
    expect(period.endSeconds).toBe(now.getTime() / 1000);
  });
});
