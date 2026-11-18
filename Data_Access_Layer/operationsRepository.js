import { query } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/businessTime";

export async function getOperations(now = new Date()) {
  const params = [now.toISOString(), BUSINESS_TIME_ZONE];
  const [entries, machines] = await Promise.all([
    query(
      `WITH clock AS (
         SELECT $1::timestamptz AT TIME ZONE $2 AS local_now
       ), days AS (
         SELECT local_now::date - day_offset AS day
         FROM clock CROSS JOIN generate_series(0, 5) AS offsets(day_offset)
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(h.user_id)::int AS count
       FROM days d CROSS JOIN clock c
       LEFT JOIN check_in_history h
         ON h.check_in_at >= d.day
        AND h.check_in_at < d.day + 1
        AND h.check_in_at <= c.local_now
        AND h.user_id IS NOT NULL
        AND (h.status = 'green' OR h.status IS NULL)
       GROUP BY d.day
       ORDER BY d.day`,
      params
    ),
    query(
      `WITH clock AS (
         SELECT $1::timestamptz AT TIME ZONE $2 AS local_now
       ), bounds AS (
         SELECT local_now, local_now::date AS today, local_now::date + 1 AS tomorrow,
                local_now::date - EXTRACT(DOW FROM local_now)::int AS week_start
         FROM clock
       ), machine_types AS (
         SELECT machine_id, COALESCE(NULLIF(TRIM(type), ''), 'Uncategorized') AS name
         FROM machine
       ), checked_in_bookings AS (
         SELECT booking.machine_id, booking.start_date_time, booking.end_date_time
         FROM machine_booking booking CROSS JOIN bounds b
         WHERE booking.end_date_time > b.week_start
           AND booking.start_date_time <= b.local_now
           AND booking.end_date_time > booking.start_date_time
           AND EXISTS (
             SELECT 1
             FROM machine_usage tap
             WHERE tap.machine_id = booking.machine_id
               AND tap.user_id = booking.user_id
               AND tap.start_at >= booking.start_date_time
               AND tap.start_at < booking.end_date_time
               AND tap.start_at <= b.local_now
               AND (tap.status = 'green' OR tap.status IS NULL)
           )
       )
       SELECT MIN(m.name) AS name,
              COALESCE(SUM(EXTRACT(EPOCH FROM (
                LEAST(booking.end_date_time, b.tomorrow) - GREATEST(booking.start_date_time, b.today)
              ))) FILTER (WHERE booking.end_date_time > b.today), 0)::float8 / 3600 AS "todayHours",
              COALESCE(SUM(EXTRACT(EPOCH FROM (
                LEAST(booking.end_date_time, b.tomorrow) - GREATEST(booking.start_date_time, b.week_start)
              ))) FILTER (WHERE booking.machine_id IS NOT NULL), 0)::float8 / 3600 AS "weekHours"
       FROM machine_types m CROSS JOIN bounds b
       LEFT JOIN checked_in_bookings booking ON booking.machine_id = m.machine_id
       GROUP BY LOWER(m.name)
       ORDER BY "todayHours" DESC, "weekHours" DESC, name`,
      params
    ),
  ]);

  return { dailyEntries: entries.rows, machines: machines.rows };
}
