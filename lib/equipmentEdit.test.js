import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../pages/api/reservations/update";
import { businessTime } from "./businessTime";

const { client, getSessionUser, verifyCsrfToken } = vi.hoisted(() => ({
  client: { query: vi.fn(), release: vi.fn() }, getSessionUser: vi.fn(), verifyCsrfToken: vi.fn(),
}));
vi.mock("./db", () => ({ getPool: () => ({ connect: async () => client }) }));
vi.mock("./session", () => ({ getSessionUser }));
vi.mock("./csrf", () => ({ verifyCsrfToken }));

let existing, conflict;
const req = () => ({ method: "POST", body: { type: "equipment", reservationId: 42,
  periods: [{ start: "2026-11-22T10:00:00", end: "2026-11-22T13:00:00" }] } });
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(businessTime("2026-11-18T10:00:00"));
  getSessionUser.mockResolvedValue({ user_id: 8, status: "ACTIVE" }); verifyCsrfToken.mockReturnValue(true);
  existing = { reservation_id: 42, resource_id: 3, stripe_checkout_session_id: "cs_paid",
    start_time: "2026-11-20T10:00:00", end_time: "2026-11-20T13:00:00" };
  conflict = false;
  client.query.mockImplementation(async sql => {
    if (sql.includes("AS reservation_id")) return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    if (sql.includes("SELECT 1 FROM")) return { rows: [], rowCount: conflict ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
});

describe("equipment editing and refund eligibility", () => {
  it("keeps editing available but atomically makes the paid booking non-refundable", async () => {
    const res = response(); await handler(req(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    const lookup = client.query.mock.calls.find(([sql]) => sql.includes("AS reservation_id"));
    expect(lookup[0]).toContain("booking_active = true");
    const update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE "));
    expect(update[0]).toContain("refund_eligible = false");
    expect(update[1]).toEqual([42, 8, "2026-11-22T10:00:00", "2026-11-22T13:00:00"]);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });
  it("leaves eligibility unchanged if the proposed move overlaps another booking", async () => {
    conflict = true;
    const res = response(); await handler(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(client.query.mock.calls.find(([sql]) => sql.includes("SELECT 1 FROM"))[0]).toContain("booking_active = true");
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE "))).toBe(false);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });
  it("rejects a cancelled or another member's booking before modifying it", async () => {
    existing = null;
    const res = response(); await handler(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE "))).toBe(false);
  });
  it("preserves the existing prohibition on unpaid additions to a paid booking", async () => {
    const request = req(); request.body.periods[0].end = "2026-11-22T14:00:00";
    const res = response(); await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE "))).toBe(false);
  });
});
