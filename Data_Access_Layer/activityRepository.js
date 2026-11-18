import { query } from "@/lib/db";

// Rolling windows measured back from right now, so "day" is always the last
// 24 hours rather than "since midnight".
export const ACTIVITY_RANGES = { hour: "1 hour", day: "24 hours" };
export const STATUS_FILTERS = ["all", "granted", "denied"];
export const EVENT_LIMIT = 500;

// Every card tap from the front door, machines, and rooms in one shape.
// status is 'green' (granted) or 'red' (denied); older rows written before
// taps were logged have no status, and those were always granted.
const TAPS = `
  SELECT 'door' AS location_type, NULL::text AS resource_name, h.user_id, h.card_id,
         COALESCE(h.status, 'green') AS status, h.check_in_at AS tapped_at
  FROM check_in_history h
  UNION ALL
  SELECT 'machine', m.name, mu.user_id, mu.card_id,
         COALESCE(mu.status, 'green'), mu.start_at
  FROM machine_usage mu
  LEFT JOIN machine m ON m.machine_id = mu.machine_id
  UNION ALL
  SELECT 'room', r.name, ru.user_id, ru.card_id,
         COALESCE(ru.status, 'green'), ru.start_at
  FROM room_usage ru
  LEFT JOIN room r ON r.room_id = ru.room_id`;

const STATUS_SQL = {
  all: "",
  granted: "AND t.status <> 'red'",
  denied: "AND t.status = 'red'",
};

export class activityRepository {
  // Counts plus the card log for the last hour or last 24 hours.
  // Only taps from cards that belong to a member are included.
  async getActivity(range = "hour", status = "all") {
    const interval = ACTIVITY_RANGES[range];
    if (!interval) throw new Error(`Unknown activity range: ${range}`);
    if (!STATUS_FILTERS.includes(status)) throw new Error(`Unknown status filter: ${status}`);

    const inWindow = `t.user_id IS NOT NULL AND t.tapped_at >= NOW() - $1::interval`;

    const [counts, events] = await Promise.all([
      query(
        `SELECT COUNT(*)::integer AS total,
                COUNT(*) FILTER (WHERE t.status <> 'red')::integer AS granted,
                COUNT(*) FILTER (WHERE t.status = 'red')::integer AS denied,
                COUNT(*) FILTER (WHERE t.status <> 'red' AND t.location_type = 'door')::integer AS door_check_ins,
                COUNT(*) FILTER (WHERE t.status <> 'red' AND t.location_type = 'machine')::integer AS machine_sessions,
                COUNT(*) FILTER (WHERE t.status <> 'red' AND t.location_type = 'room')::integer AS room_sessions,
                COUNT(DISTINCT t.user_id)::integer AS unique_members
         FROM (${TAPS}) t
         WHERE ${inWindow}`,
        [interval]
      ),
      query(
        `SELECT t.location_type, t.resource_name, t.user_id, t.card_id, t.status, t.tapped_at,
                u.first_name, u.last_name
         FROM (${TAPS}) t
         JOIN users u ON u.user_id = t.user_id
         WHERE ${inWindow} ${STATUS_SQL[status]}
         ORDER BY t.tapped_at DESC
         LIMIT ${EVENT_LIMIT}`,
        [interval]
      ),
    ]);

    const c = counts.rows[0] || {};
    const totals = {
      total: c.total || 0,
      granted: c.granted || 0,
      denied: c.denied || 0,
      doorCheckIns: c.door_check_ins || 0,
      machineSessions: c.machine_sessions || 0,
      roomSessions: c.room_sessions || 0,
      uniqueMembers: c.unique_members || 0,
    };
    const matching = status === "all" ? totals.total : totals[status];

    return {
      range,
      status,
      counts: totals,
      events: events.rows.map((row) => ({
        locationType: row.location_type,
        resourceName: row.resource_name,
        userId: row.user_id,
        name: [row.first_name, row.last_name].filter(Boolean).join(" "),
        cardId: row.card_id,
        granted: row.status !== "red",
        tappedAt: row.tapped_at,
      })),
      truncated: matching > events.rows.length,
    };
  }
}

export default activityRepository;
