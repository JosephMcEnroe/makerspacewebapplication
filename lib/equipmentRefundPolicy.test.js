import { describe, expect, it } from "vitest";
import { businessTime } from "./businessTime";
import { allocateCents, calculateCancellation, cents, dollars, equipmentHours } from "./equipmentRefundPolicy";

const booking = { start_date_time: "2026-11-20T10:00:00", end_date_time: "2026-11-20T13:00:00",
  paid_amount: "60.00", payment_id: 1, stripe_payment_intent_id: "pi_test", refund_eligible: true };

describe("equipment refund policy", () => {
  it("includes exactly 24 hours and excludes the next millisecond inside the deadline", () => {
    const boundary = businessTime("2026-11-19T10:00:00");
    expect(calculateCancellation(booking, boundary).refundAmount).toBe("60.00");
    expect(calculateCancellation(booking, boundary + 1)).toMatchObject({ refundAmount: "40.00", forfeitedAmount: "20.00" });
  });
  it("calculates mixed eligibility per hour, rather than the reservation start", () => {
    expect(calculateCancellation(booking, businessTime("2026-11-19T11:00:00"))).toMatchObject({ refundAmount: "40.00", forfeitedAmount: "20.00" });
  });
  it("never refunds an edited, historical, or unpaid reservation", () => {
    for (const changes of [{ refund_eligible: false }, { paid_amount: null }, { payment_id: null }, { stripe_payment_intent_id: null }]) {
      expect(calculateCancellation({ ...booking, ...changes }, businessTime("2026-11-18T10:00:00")).refundAmount).toBe("0.00");
    }
  });
  it("cancels studio-covered zero-dollar equipment without a refund", () => {
    expect(calculateCancellation({ ...booking, paid_amount: "0.00", stripe_payment_intent_id: null }, businessTime("2026-11-18T10:00:00")))
      .toMatchObject({ refundAmount: "0.00", forfeitedAmount: "0.00" });
  });
  it("excludes started hours and does not treat cleanup as another purchased hour", () => {
    const result = calculateCancellation(booking, businessTime("2026-11-20T10:30:00"));
    expect(result.hours).toHaveLength(2);
    expect(result).toMatchObject({ refundAmount: "0.00", forfeitedAmount: "40.00" });
    expect(equipmentHours(booking.start_date_time, booking.end_date_time)).toHaveLength(3);
  });
  it("uses 24 elapsed hours over spring and autumn DST changes", () => {
    for (const [start, boundary] of [["2027-03-14T10:00:00", "2027-03-13T09:00:00"], ["2026-11-01T10:00:00", "2026-10-31T11:00:00"]]) {
      const one = { ...booking, start_date_time: start, end_date_time: start.replace("10:00", "11:00"), paid_amount: "20.00" };
      const now = businessTime(boundary);
      expect(calculateCancellation(one, now).refundAmount).toBe("20.00");
      expect(calculateCancellation(one, now + 1).refundAmount).toBe("0.00");
    }
  });
  it("allocates tax/discount-inclusive totals without losing or creating cents", () => {
    expect(allocateCents(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocateCents(1001, [3, 2])).toEqual([601, 400]);
    const result = calculateCancellation({ ...booking, paid_amount: "10.00" }, businessTime("2026-11-19T10:00:01"));
    expect(result).toMatchObject({ refundAmount: "6.66", forfeitedAmount: "3.34" });
    expect(cents("25.10")).toBe(2510);
    expect(dollars(2510)).toBe("25.10");
    expect(() => cents("-1.00")).toThrow();
  });
});
