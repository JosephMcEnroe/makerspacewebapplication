import { describe, expect, it } from "vitest";
import { businessTime } from "./businessTime";
import { effectiveMembershipStatus, isDayPass, isDayPassExpired } from "./membershipStatus";

const dayPass = { status: "ACTIVE", stripe_subscription_id: null, auto_renew: false, period_end_date: "2026-10-19" };
const at = (wallTime) => new Date(businessTime(wallTime));

describe("day pass expiry", () => {
  it("is valid for the rest of the purchase day, Eastern time", () => {
    expect(isDayPassExpired(dayPass, at("2026-10-19T12:00:00"))).toBe(false);
    // 11:59 PM Eastern is already the next day in UTC
    expect(isDayPassExpired(dayPass, at("2026-10-19T23:59:00"))).toBe(false);
    expect(effectiveMembershipStatus(dayPass, at("2026-10-19T23:59:00"))).toBe("ACTIVE");
  });
  it("expires at midnight Eastern", () => {
    expect(isDayPassExpired(dayPass, at("2026-10-20T00:00:00"))).toBe(true);
    expect(effectiveMembershipStatus(dayPass, at("2026-10-20T00:00:00"))).toBe("INACTIVE");
  });
  it("accepts DATE columns parsed as Eastern midnight", () => {
    expect(isDayPassExpired({ ...dayPass, period_end_date: at("2026-10-19T00:00:00") }, at("2026-10-19T22:00:00"))).toBe(false);
  });
  it("never expires monthly memberships early", () => {
    const monthly = { ...dayPass, stripe_subscription_id: "sub_123", auto_renew: true };
    expect(isDayPass(monthly)).toBe(false);
    expect(effectiveMembershipStatus(monthly, at("2026-11-30T12:00:00"))).toBe("ACTIVE");
    // A cancelled-at-period-end subscription still has its subscription id, so it is not a day pass
    expect(isDayPass({ ...monthly, auto_renew: false })).toBe(false);
  });
  it("leaves inactive and missing memberships alone", () => {
    expect(effectiveMembershipStatus({ status: "inactive" })).toBe("INACTIVE");
    expect(effectiveMembershipStatus(null)).toBe(null);
  });
});
