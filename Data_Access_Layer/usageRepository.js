import { getPool, query } from "@/lib/db";

// The DB session runs in America/New_York (lib/db.js), so CURRENT_DATE is the
// Eastern date and this is Eastern midnight today.
const TODAY_START = "CURRENT_DATE::timestamptz";

// A second tap this soon after the first is treated as a repeat, not a toggle,
// so a double-tap doesn't check someone in and straight back out.
const DOUBLE_TAP_SECONDS = 60;

// Equipment can be booked 8:00 AM - 11:30 PM, used as 100% for daily utilization.
const EQUIPMENT_HOURS_PER_DAY = 15.5;

// machine_booking / room_reservation hold Eastern wall-clock times without a
// timezone, while the usage tables use TIMESTAMPTZ.
const RESOURCES = {
  equipment: {
    table: "machine_usage",
    column: "machine_id",
    resourceTable: "machine",
    bookingTable: "machine_booking",
    bookingStart: "start_date_time",
    bookingEnd: "end_date_time",
    bookingFilter: "",
    // One person on a machine at a time
    shared: false,
  },
  studio: {
    table: "room_usage",
    column: "room_id",
    resourceTable: "room",
    bookingTable: "room_reservation",
    bookingStart: "start_date",
    bookingEnd: "end_date",
    bookingFilter: "AND (b.status IS NULL OR LOWER(TRIM(b.status)) NOT LIKE 'cancel%')",
    // Several people can be in a room
    shared: true,
  },
};

// Sessions nobody tapped out of are closed at the end of the booking they started
// under, once that booking is over. resourceId limits it to one machine/room.
function closeStaleSessions(client, mode, resourceId = null) {
  const r = RESOURCES[mode];
  return client.query(
    `UPDATE ${r.table} u
     SET end_at = GREATEST(u.start_at, LEAST(NOW(), COALESCE((
       SELECT MAX(b.${r.bookingEnd}) AT TIME ZONE 'America/New_York'
       FROM ${r.bookingTable} b
       WHERE b.user_id = u.user_id AND b.${r.column} = u.${r.column}
         AND b.${r.bookingStart} <= (u.start_at AT TIME ZONE 'America/New_York')
         AND b.${r.bookingEnd} > (u.start_at AT TIME ZONE 'America/New_York')
         ${r.bookingFilter}
     ), u.start_at)))
     WHERE u.end_at IS NULL
       AND ($1::integer IS NULL OR u.${r.column} = $1)
       AND NOT EXISTS (
         SELECT 1 FROM ${r.bookingTable} b
         WHERE b.user_id = u.user_id AND b.${r.column} = u.${r.column}
           AND b.${r.bookingStart} <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
           AND b.${r.bookingEnd} > (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
           ${r.bookingFilter}
       )`,
    [resourceId]
  );
}

async function inTransaction(lockKey, lockId, work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [lockKey, lockId]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export class usageRepository {
    //Front-door tap: checks the user in, or out if they're already in today.
    //Returns "checked_in" or "checked_out".
    async recordDoorTap(userId) {
        return inTransaction("check_in_history", userId, async (client) => {
            const open = await client.query(
                `SELECT check_in_id, EXTRACT(EPOCH FROM NOW() - check_in_at) AS age_seconds
                 FROM check_in_history
                 WHERE user_id = $1 AND check_out_at IS NULL AND check_in_at >= ${TODAY_START}
                 ORDER BY check_in_at DESC
                 LIMIT 1`,
                [userId]
            );
            if (open.rows[0]) {
                if (Number(open.rows[0].age_seconds) < DOUBLE_TAP_SECONDS) return "checked_in";
                await client.query(
                    `UPDATE check_in_history SET check_out_at = NOW() WHERE check_in_id = $1`,
                    [open.rows[0].check_in_id]
                );
                return "checked_out";
            }
            await client.query(`INSERT INTO check_in_history (user_id) VALUES ($1)`, [userId]);
            // check_in keeps each user's latest check-in, as before
            await client.query(
                `INSERT INTO check_in (user_id, datetime)
                 VALUES ($1, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id)
                 DO UPDATE SET datetime = EXCLUDED.datetime`,
                [userId]
            );
            return "checked_in";
        });
    }

    //Machine/room tap by a user with a current booking: starts a session, or ends
    //their open one. mode is "equipment" or "studio". Returns "started" or "ended".
    async recordResourceTap(mode, userId, resourceId) {
        const r = RESOURCES[mode];
        return inTransaction(r.table, resourceId, async (client) => {
            await closeStaleSessions(client, mode, resourceId);
            const open = await client.query(
                `SELECT usage_id, EXTRACT(EPOCH FROM NOW() - start_at) AS age_seconds
                 FROM ${r.table}
                 WHERE ${r.column} = $1 AND user_id = $2 AND end_at IS NULL
                 ORDER BY start_at DESC
                 LIMIT 1`,
                [resourceId, userId]
            );
            if (open.rows[0]) {
                if (Number(open.rows[0].age_seconds) < DOUBLE_TAP_SECONDS) return "started";
                await client.query(`UPDATE ${r.table} SET end_at = NOW() WHERE usage_id = $1`, [open.rows[0].usage_id]);
                return "ended";
            }
            if (!r.shared) {
                // Someone else left without tapping out; their session ends now
                await client.query(
                    `UPDATE ${r.table} SET end_at = NOW() WHERE ${r.column} = $1 AND end_at IS NULL`,
                    [resourceId]
                );
            }
            await client.query(
                `INSERT INTO ${r.table} (user_id, ${r.column}) VALUES ($1, $2)`,
                [userId, resourceId]
            );
            return "started";
        });
    }

    //Who is in the space and on which machines/rooms right now, plus recent taps
    async getLiveActivity() {
        const pool = getPool();
        await Promise.all(Object.keys(RESOURCES).map((mode) => closeStaleSessions(pool, mode)));
        const [checkedIn, machines, rooms, recent] = await Promise.all([
            query(
                `SELECT h.check_in_id AS id, h.user_id, u.first_name, u.last_name, h.check_in_at AS start_at
                 FROM check_in_history h
                 JOIN users u ON u.user_id = h.user_id
                 WHERE h.check_out_at IS NULL AND h.check_in_at >= ${TODAY_START}
                 ORDER BY h.check_in_at DESC`
            ),
            query(
                `SELECT mu.usage_id AS id, mu.user_id, u.first_name, u.last_name, m.name AS resource_name, mu.start_at
                 FROM machine_usage mu
                 JOIN users u ON u.user_id = mu.user_id
                 JOIN machine m ON m.machine_id = mu.machine_id
                 WHERE mu.end_at IS NULL
                 ORDER BY m.name`
            ),
            query(
                `SELECT ru.usage_id AS id, ru.user_id, u.first_name, u.last_name, r.name AS resource_name, ru.start_at
                 FROM room_usage ru
                 JOIN users u ON u.user_id = ru.user_id
                 JOIN room r ON r.room_id = ru.room_id
                 WHERE ru.end_at IS NULL
                 ORDER BY r.name, ru.start_at`
            ),
            query(
                `SELECT * FROM (
                   SELECT 'door' AS kind, h.check_in_id AS id, h.user_id, u.first_name, u.last_name,
                          NULL AS resource_name, h.check_in_at AS start_at, h.check_out_at AS end_at
                   FROM check_in_history h JOIN users u ON u.user_id = h.user_id
                   UNION ALL
                   SELECT 'machine', mu.usage_id, mu.user_id, u.first_name, u.last_name,
                          m.name, mu.start_at, mu.end_at
                   FROM machine_usage mu JOIN users u ON u.user_id = mu.user_id
                   JOIN machine m ON m.machine_id = mu.machine_id
                   UNION ALL
                   SELECT 'room', ru.usage_id, ru.user_id, u.first_name, u.last_name,
                          r.name, ru.start_at, ru.end_at
                   FROM room_usage ru JOIN users u ON u.user_id = ru.user_id
                   JOIN room r ON r.room_id = ru.room_id
                 ) events
                 ORDER BY GREATEST(start_at, COALESCE(end_at, start_at)) DESC
                 LIMIT 20`
            ),
        ]);
        return {
            checkedIn: checkedIn.rows,
            machinesInUse: machines.rows,
            roomsInUse: rooms.rows,
            recent: recent.rows,
        };
    }

    //Admin dashboard numbers: daily visitors for the last 7 days and today's machine hours
    async getUsageStats() {
        const [daily, machines, today] = await Promise.all([
            query(
                `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT h.user_id)::integer AS visitors
                 FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, INTERVAL '1 day') AS d(day)
                 LEFT JOIN check_in_history h
                   ON h.check_in_at >= d.day::timestamptz
                  AND h.check_in_at < (d.day + INTERVAL '1 day')::timestamptz
                 GROUP BY d.day
                 ORDER BY d.day`
            ),
            query(
                `SELECT m.machine_id, m.name,
                        COALESCE(SUM(EXTRACT(EPOCH FROM
                          LEAST(COALESCE(mu.end_at, NOW()), NOW()) - GREATEST(mu.start_at, ${TODAY_START})
                        )), 0) / 3600 AS hours
                 FROM machine m
                 LEFT JOIN machine_usage mu
                   ON mu.machine_id = m.machine_id
                  AND COALESCE(mu.end_at, NOW()) > ${TODAY_START}
                 GROUP BY m.machine_id, m.name
                 ORDER BY hours DESC, m.name`
            ),
            query(
                `SELECT COUNT(DISTINCT user_id)::integer AS visitors
                 FROM check_in_history
                 WHERE check_in_at >= ${TODAY_START}`
            ),
        ]);
        return {
            visitorsToday: today.rows[0]?.visitors || 0,
            dailyVisitors: daily.rows.map((row) => ({ day: row.day, visitors: row.visitors })),
            machineUsageToday: machines.rows.map((row) => {
                const hours = Math.max(Number(row.hours) || 0, 0);
                return {
                    machineId: row.machine_id,
                    name: row.name,
                    hours,
                    percent: Math.min(Math.round((hours / EQUIPMENT_HOURS_PER_DAY) * 100), 100),
                };
            }),
        };
    }

    //One member's recent check-ins and machine/room sessions, for the staff member page
    async findUserActivity(userId, limit = 15) {
        const [visits, sessions] = await Promise.all([
            query(
                `SELECT check_in_id AS id, check_in_at AS start_at, check_out_at AS end_at
                 FROM check_in_history
                 WHERE user_id = $1
                 ORDER BY check_in_at DESC
                 LIMIT $2`,
                [userId, limit]
            ),
            query(
                `SELECT * FROM (
                   SELECT 'machine' AS kind, mu.usage_id AS id, m.name AS resource_name, mu.start_at, mu.end_at
                   FROM machine_usage mu JOIN machine m ON m.machine_id = mu.machine_id
                   WHERE mu.user_id = $1
                   UNION ALL
                   SELECT 'room', ru.usage_id, r.name, ru.start_at, ru.end_at
                   FROM room_usage ru JOIN room r ON r.room_id = ru.room_id
                   WHERE ru.user_id = $1
                 ) sessions
                 ORDER BY start_at DESC
                 LIMIT $2`,
                [userId, limit]
            ),
        ]);
        return { visits: visits.rows, sessions: sessions.rows };
    }
}

export default usageRepository;
