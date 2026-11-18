import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ query: vi.fn() }));
import { query } from "@/lib/db";
import { activityRepository, EVENT_LIMIT } from "@/Data_Access_Layer/activityRepository";
import checkin from "@/pages/api/checkin";

const COUNTS = {
  total: 3, granted: 2, denied: 1, door_check_ins: 1,
  machine_sessions: 1, room_sessions: 0, unique_members: 2,
};

function database({ counts = COUNTS, events = [] } = {}) {
  return async (sql) => (sql.includes("COUNT(*)") ? { rows: [counts] } : { rows: events });
}

describe("activityRepository.getActivity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses a rolling 1 hour window for the last hour", async () => {
    query.mockImplementation(database());
    await new activityRepository().getActivity("hour");
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("NOW() - $1::interval");
      expect(params).toEqual(["1 hour"]);
    }
  });

  it("uses a rolling 24 hour window for the last day, not midnight", async () => {
    query.mockImplementation(database());
    await new activityRepository().getActivity("day");
    for (const [sql, params] of query.mock.calls) {
      expect(sql).not.toContain("CURRENT_DATE");
      expect(params).toEqual(["24 hours"]);
    }
  });

  it("reads door, machine, and room taps and skips taps with no member", async () => {
    query.mockImplementation(database());
    await new activityRepository().getActivity("hour");
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain("FROM check_in_history");
      expect(sql).toContain("FROM machine_usage");
      expect(sql).toContain("FROM room_usage");
      expect(sql).toContain("t.user_id IS NOT NULL");
    }
  });

  it("returns counts and maps events for the card log", async () => {
    query.mockImplementation(database({
      events: [{
        location_type: "machine", resource_name: "Laser Cutter", user_id: 4, card_id: "abc",
        status: "red", tapped_at: "2026-11-18T15:00:00Z", first_name: "Ada", last_name: "Lovelace",
      }],
    }));
    const result = await new activityRepository().getActivity("hour");
    expect(result.counts).toEqual({
      total: 3, granted: 2, denied: 1, doorCheckIns: 1,
      machineSessions: 1, roomSessions: 0, uniqueMembers: 2,
    });
    expect(result.events).toEqual([{
      locationType: "machine", resourceName: "Laser Cutter", userId: 4, name: "Ada Lovelace",
      cardId: "abc", granted: false, tappedAt: "2026-11-18T15:00:00Z",
    }]);
    expect(result.truncated).toBe(true);
  });

  it("filters the card log to denied taps only", async () => {
    query.mockImplementation(database());
    await new activityRepository().getActivity("day", "denied");
    const eventSql = query.mock.calls.map(([sql]) => sql).find((sql) => sql.includes("ORDER BY"));
    expect(eventSql).toContain("AND t.status = 'red'");
    expect(eventSql).toContain(`LIMIT ${EVENT_LIMIT}`);
  });

  it("rejects unknown ranges and filters", async () => {
    await expect(new activityRepository().getActivity("week")).rejects.toThrow();
    await expect(new activityRepository().getActivity("hour", "maybe")).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("front door tap logging", () => {
  function response() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  }
  const tap = () => checkin(
    { method: "POST", headers: {}, body: { card_id: " ABC " } },
    response()
  );
  const historyInsert = () => query.mock.calls.find(([sql]) => sql.includes("INSERT INTO check_in_history"));

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.MAKERSPACE_API_KEY;
  });

  it("logs a granted tap for an active member", async () => {
    query.mockResolvedValueOnce({ rows: [{ user_id: 12, member_status: "active" }] });
    query.mockResolvedValue({ rows: [] });
    await tap();
    expect(historyInsert()[1]).toEqual([12, "abc", "green"]);
  });

  it("logs a denied tap for an inactive member", async () => {
    query.mockResolvedValueOnce({ rows: [{ user_id: 12, member_status: "inactive" }] });
    query.mockResolvedValue({ rows: [] });
    await tap();
    expect(historyInsert()[1]).toEqual([12, "abc", "red"]);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO check_in ("))).toBe(false);
  });

  it("does not log a card that belongs to nobody", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await tap();
    expect(historyInsert()).toBeUndefined();
  });
});
