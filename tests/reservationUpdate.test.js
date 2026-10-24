import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "@/pages/api/reservations/update";

const mocks = vi.hoisted(() => ({ query: vi.fn(), user: vi.fn(), csrf: vi.fn(), release: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ connect: async () => ({ query: mocks.query, release: mocks.release }) }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/csrf", () => ({ verifyCsrfToken: mocks.csrf }));

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

const periods = [
  { start: "2026-10-20T06:00:00", end: "2026-10-20T07:00:00" },
  { start: "2026-10-20T07:00:00", end: "2026-10-20T08:00:00" },
  { start: "2026-10-20T08:00:00", end: "2026-10-20T09:00:00" },
];

describe("reservation update API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-15T16:00:00Z"));
    mocks.user.mockResolvedValue({ user_id: 18 });
    mocks.csrf.mockReturnValue(true);
    mocks.query.mockImplementation(async sql => {
      if (sql.includes("SELECT machine_id AS resource_id")) {
        return { rows: [{ resource_id: 7, stripe_checkout_session_id: "cs_paid", start_time: new Date("2026-10-20T10:00:00Z"), end_time: new Date("2026-10-20T13:00:00Z") }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it("reschedules one paid booking across three contiguous hours without splitting or changing duration", async () => {
    const res = response();
    await handler({ method: "POST", body: { type: "equipment", reservationId: 42, periods } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO "machine_booking"'))).toHaveLength(0);
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('UPDATE "machine_booking"'))).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "machine_booking"'),
      [42, 18, "2026-10-20T06:00:00", "2026-10-20T09:00:00"]
    );
    expect(mocks.query.mock.calls.at(-1)[0]).toBe("COMMIT");
  });

  it("rejects a paid booking edit that changes the purchased duration", async () => {
    const res = response();
    await handler({ method: "POST", body: { type: "equipment", reservationId: 42, periods: periods.slice(0, 2) } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "A paid machine reservation must keep the same total number of hours." });
    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("UPDATE machine_booking") || sql.includes('INSERT INTO "machine_booking"'))).toBe(false);
  });
});
