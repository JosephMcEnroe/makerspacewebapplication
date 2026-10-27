import { query } from "@/lib/db";

export function authenticateReader(req, res) {
  const key = process.env.MAKERSPACE_API_KEY;
  if (!key) {
    res.status(503).json({ error: "RFID API is not configured" });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${key}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export function resourceCheckin(mode) {
  return async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    if (!authenticateReader(req, res)) return;
    const { card_id, resource_id } = req.body || {};
    if (typeof card_id !== "string" || !card_id.trim() ||
        !/^[1-9]\d*$/.test(String(resource_id)) || !Number.isSafeInteger(Number(resource_id))) {
      return res.status(400).json({ error: "Provide card_id and a positive resource_id" });
    }
    const deny = (message) => res.status(200).json({ ok: false, status: "red", message });
    try {
      const members = await query(
        `SELECT u.user_id, u.first_name, u.last_name, m.status AS member_status, m.role_of_membership
         FROM membership m JOIN users u ON u.user_id = m.user_id
         WHERE LOWER(m.rfid_id::text) = $1`, [card_id.trim().toLowerCase()]);
      if (members.rows.length !== 1) return deny("Unknown or ambiguous card");
      const user = members.rows[0];
      if (String(user.member_status).trim().toUpperCase() !== "ACTIVE") {
        return deny("Access denied: membership is not active");
      }
      // Stored reservation timestamps are Eastern wall-clock values, without a timezone.
      const bookings = mode === "equipment"
        ? await query(
          `SELECT 1 FROM machine_booking
           WHERE user_id = $1 AND machine_id = $2
             AND start_date_time <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
             AND end_date_time > (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
           LIMIT 1`, [user.user_id, Number(resource_id)])
        : await query(
          `SELECT 1 FROM room_reservation
           WHERE user_id = $1 AND room_id = $2
             AND (status IS NULL OR LOWER(TRIM(status)) NOT LIKE 'cancel%')
             AND start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
             AND end_date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')
           LIMIT 1`, [user.user_id, Number(resource_id)]);
      if (!bookings.rows.length) return deny("No current reservation for this resource");
      return res.status(200).json({
        ok: true, status: "green", message: "Access granted",
        user: { first_name: user.first_name, last_name: user.last_name,
          status: user.member_status, role: user.role_of_membership },
      });
    } catch (error) {
      console.error("RFID reservation check failed:", error);
      return res.status(500).json({ ok: false, status: "red", error: "Reservation check failed" });
    }
  };
}
