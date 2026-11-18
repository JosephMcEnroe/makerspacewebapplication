import { beforeEach, describe, expect, it, vi } from "vitest";
import { usageRepository } from "@/Data_Access_Layer/usageRepository";

const { client } = vi.hoisted(() => ({ client: { query: vi.fn(), release: vi.fn() } }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ connect: async () => client, query: client.query }), query: client.query }));

// openRow: the user's open visit/session, or null. ageSeconds: how long ago it started.
function database({ openRow = null } = {}) {
  return async (sql) => {
    if (sql.includes("age_seconds")) return { rows: openRow ? [openRow] : [], rowCount: openRow ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  };
}
const calls = (text) => client.query.mock.calls.filter(([sql]) => sql.includes(text));

describe("front door taps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks in when there's no open visit today, and records the latest check-in", async () => {
    client.query.mockImplementation(database());
    await expect(new usageRepository().recordDoorTap(18)).resolves.toBe("checked_in");
    expect(calls("INSERT INTO check_in_history")[0][1]).toEqual([18]);
    expect(calls("INSERT INTO check_in ")).toHaveLength(1);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("checks out on the next tap", async () => {
    client.query.mockImplementation(database({ openRow: { check_in_id: 7, age_seconds: 3600 } }));
    await expect(new usageRepository().recordDoorTap(18)).resolves.toBe("checked_out");
    expect(calls("SET check_out_at = NOW()")[0][1]).toEqual([7]);
    expect(calls("INSERT")).toHaveLength(0);
  });

  it("ignores a double tap instead of checking straight back out", async () => {
    client.query.mockImplementation(database({ openRow: { check_in_id: 7, age_seconds: 5 } }));
    await expect(new usageRepository().recordDoorTap(18)).resolves.toBe("checked_in");
    expect(calls("UPDATE")).toHaveLength(0);
    expect(calls("INSERT")).toHaveLength(0);
  });

  it("rolls back when the database fails", async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes("INSERT INTO check_in_history")) throw Error("database unavailable");
      return { rows: [], rowCount: 0 };
    });
    await expect(new usageRepository().recordDoorTap(18)).rejects.toThrow("database unavailable");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("machine and room taps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts a machine session and ends anyone else's open session on that machine", async () => {
    client.query.mockImplementation(database());
    await expect(new usageRepository().recordResourceTap("equipment", 18, 3)).resolves.toBe("started");
    expect(calls("UPDATE machine_usage SET end_at = NOW() WHERE machine_id")[0][1]).toEqual([3]);
    expect(calls("INSERT INTO machine_usage")[0][1]).toEqual([18, 3]);
    expect(client.query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtext($1), $2)", ["machine_usage", 3]);
  });

  it("ends the user's own session on the next tap", async () => {
    client.query.mockImplementation(database({ openRow: { usage_id: 9, age_seconds: 1800 } }));
    await expect(new usageRepository().recordResourceTap("equipment", 18, 3)).resolves.toBe("ended");
    expect(calls("SET end_at = NOW() WHERE usage_id")[0][1]).toEqual([9]);
    expect(calls("INSERT")).toHaveLength(0);
  });

  it("lets several people share a room", async () => {
    client.query.mockImplementation(database());
    await expect(new usageRepository().recordResourceTap("studio", 18, 2)).resolves.toBe("started");
    expect(calls("UPDATE room_usage SET end_at = NOW() WHERE room_id")).toHaveLength(0);
    expect(calls("INSERT INTO room_usage")[0][1]).toEqual([18, 2]);
  });

  it("closes sessions nobody tapped out of before checking", async () => {
    client.query.mockImplementation(database());
    await new usageRepository().recordResourceTap("studio", 18, 2);
    const stale = calls("UPDATE room_usage u");
    expect(stale).toHaveLength(1);
    expect(stale[0][1]).toEqual([2]);
  });
});
