import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ query: vi.fn() }));
vi.mock("@/lib/membershipEligibility", () => ({ hasActiveMembership: vi.fn() }));
import { query } from "@/lib/db";
import { hasActiveMembership } from "@/lib/membershipEligibility";
import space from "@/pages/api/checkin";
import { resourceCheckin } from "./rfidAccess";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe("card tap logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MAKERSPACE_API_KEY = "test-key";
  });

  for (const [mode, table] of [["space", "check_in_history"], ["studio", "room_usage"], ["equipment", "machine_usage"]]) {
    for (const scenario of ["unknown", "denied", "granted"]) {
      it(`logs a ${scenario} ${mode} tap`, async () => {
        const user = { user_id: 12, member_status: "active" };
        query.mockResolvedValueOnce({ rows: scenario === "unknown" ? [] : [user] });
        hasActiveMembership.mockReturnValue(scenario === "granted");
        if (scenario === "granted" && mode !== "space") query.mockResolvedValueOnce({ rows: [{}] });
        query.mockResolvedValue({ rows: [] });
        const req = { method: "POST", headers: { authorization: "Bearer test-key" }, body: { card_id: " ABC ", resource_id: "7" } };
        const res = response();
        await (mode === "space" ? space(req, res) : resourceCheckin(mode)(req, res));
        const insert = query.mock.calls.find(([sql]) => sql.includes(`INSERT INTO ${table}`));
        expect(insert).toBeDefined();
        const status = scenario === "granted" ? "green" : "red";
        expect(insert[1]).toEqual(mode === "space"
          ? [scenario === "unknown" ? null : 12, "abc", status]
          : [scenario === "unknown" ? null : 12, 7, "abc", status]);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status }));
        expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO check_in ("))).toBe(mode === "space" && scenario === "granted");
      });
    }
  }
});
