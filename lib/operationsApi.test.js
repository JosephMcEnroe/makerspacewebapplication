import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "@/pages/api/admin/operations";
import { getOperations } from "@/Data_Access_Layer/operationsRepository";
import { getStaffSession } from "@/lib/staffAuth";

vi.mock("@/Data_Access_Layer/operationsRepository", () => ({ getOperations: vi.fn() }));
vi.mock("@/lib/staffAuth", () => ({ getStaffSession: vi.fn() }));

describe("admin operations API", () => {
  let res;

  beforeEach(() => {
    vi.resetAllMocks();
    res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it.each([[null, 401], [{ isAdmin: false }, 403]])(
    "rejects unauthorized access with session %j",
    async (session, status) => {
      getStaffSession.mockResolvedValue(session);
      await handler({ method: "GET" }, res);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(getOperations).not.toHaveBeenCalled();
    }
  );

  it("returns live data without caching it", async () => {
    const operations = { dailyEntries: [{ date: "2026-11-18", count: 0 }], machines: [] };
    getStaffSession.mockResolvedValue({ isAdmin: true });
    getOperations.mockResolvedValue(operations);
    await handler({ method: "GET" }, res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(operations);
  });
});
