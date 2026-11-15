import { describe, expect, it } from "vitest";
import { businessTime } from "./businessTime";
import { hasActiveMembership } from "./membershipEligibility";

const active = { status: "ACTIVE", period_start_date: "2026-11-01", period_end_date: "2026-11-15" };
const now = businessTime("2026-11-15T12:00:00");

describe("membership eligibility", () => {
  it("accepts an active membership and normalizes status", () => {
    expect(hasActiveMembership(active, now)).toBe(true);
    expect(hasActiveMembership({ ...active, status: " active " }, now)).toBe(true);
  });
  it.each([null, {}, { ...active, status: "INACTIVE" }, { ...active, status: null }])("denies missing or inactive membership", member => {
    expect(hasActiveMembership(member, now)).toBe(false);
  });
  it("allows open-ended manually managed memberships", () => expect(hasActiveMembership({ status: "ACTIVE" }, now)).toBe(true));
  it("rejects future starts and expired periods even when status is active", () => {
    expect(hasActiveMembership({ ...active, period_start_date: "2026-11-16" }, now)).toBe(false);
    expect(hasActiveMembership({ ...active, period_end_date: "2026-11-14" }, now)).toBe(false);
  });
  it("includes the whole last Eastern calendar day for a day pass", () => {
    const pass = { status: "ACTIVE", period_start_date: "2026-11-15", period_end_date: "2026-11-15", auto_renew: false };
    expect(hasActiveMembership(pass, businessTime("2026-11-15T00:00:00"))).toBe(true);
    expect(hasActiveMembership(pass, businessTime("2026-11-15T23:59:59"))).toBe(true);
    expect(hasActiveMembership(pass, businessTime("2026-11-16T00:00:00"))).toBe(false);
  });
  it("treats timestamp expiration as exclusive, without extending it another day", () => {
    const member = { ...active, period_end_date: "2026-11-15T12:00:00" };
    expect(hasActiveMembership(member, now - 1)).toBe(true);
    expect(hasActiveMembership(member, now)).toBe(false);
    expect(hasActiveMembership({ ...member, period_end_date: new Date(now) }, now)).toBe(false);
  });
  it("uses Eastern midnight over daylight saving transitions", () => {
    expect(hasActiveMembership({ status: "ACTIVE", period_end_date: "2026-11-01" }, Date.parse("2026-11-02T04:59:59Z"))).toBe(true);
    expect(hasActiveMembership({ status: "ACTIVE", period_end_date: "2026-11-01" }, Date.parse("2026-11-02T05:00:00Z"))).toBe(false);
  });
  it("respects PostgreSQL timestamp timezone offsets", () => {
    expect(hasActiveMembership({ ...active, period_end_date: "2026-11-15 12:00:00+00" }, now)).toBe(false);
    expect(hasActiveMembership({ ...active, period_end_date: "2026-11-15 12:00:00-05" }, now - 1)).toBe(true);
    expect(hasActiveMembership({ ...active, period_end_date: "2026-11-15 12:00:00-05" }, now)).toBe(false);
  });
  it.each(["invalid", "2026-02-30", ""]) ("denies malformed stored dates", value => {
    expect(hasActiveMembership({ ...active, period_end_date: value }, now)).toBe(false);
    expect(hasActiveMembership({ ...active, period_start_date: value }, now)).toBe(false);
  });
});
