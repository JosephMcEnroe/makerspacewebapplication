import { query } from "@/lib/db";

export default async function handler(req, res) {
  // If visited via browser (GET), return a friendly status check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Makerspace Check-in API",
      status: "online",
      message: "Ready to accept POST requests with { card_id }",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  // 1. Authenticate with Bearer token if MAKERSPACE_API_KEY is 
  // Authorization: Bearer APIKEY is whats being sent
  const expectedApiKey = process.env.MAKERSPACE_API_KEY;
  if (expectedApiKey) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : null;

    if (!token || token !== expectedApiKey) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized: Invalid or missing API key",
      });
    }
  }

  const { card_id } = req.body || {};

  if (!card_id || typeof card_id !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Missing or invalid card_id in request body",
    });
  }

  const normalizedCardId = card_id.toLowerCase().trim();

  try {
    // 2. Query user and membership details by rfid_id
    // Cast to text to prevent Postgres type mismatches if rfid_id is integer/varchar
    const userResult = await query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.rfid_id,
              m.status AS member_status, m.type_of_membership, m.period_end_date
       FROM users u
       LEFT JOIN member m ON u.user_id = m.user_id
       WHERE LOWER(u.rfid_id::text) = LOWER($1::text)`,
      [normalizedCardId]
    );

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        ok: false,
        status: "red",
        message: "Unknown card or unregistered user",
      });
    }

    const user = userResult.rows[0];
    const memberStatus = (user.member_status || "").toLowerCase().trim();

    // 3. Determine traffic light decision
    // Active membership -> Green
    // Warning / Pending / Grace -> Yellow
    // Inactive / Suspended / Expired -> Red
    let decision = "green";
    let message = "Access granted";

    if (
      memberStatus === "inactive" ||
      memberStatus === "suspended" ||
      memberStatus === "expired"
    ) {
      decision = "red";
      message = `Access denied: membership is ${memberStatus}`;
    } 
    // we dont really need this condition for checkin, but ive left it as placeholder
    else if (
      memberStatus === "warning" ||
      memberStatus === "pending" ||
      memberStatus === "grace"
    ) {
      decision = "yellow";
      message = `Notice: membership status is ${memberStatus}`;
    }

    // 4. If access is granted (Green or Yellow), record check-in
    if (decision !== "red") {
      await query(
        `UPDATE users
         SET last_check_in = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [user.user_id]
      );

      await query(
        `INSERT INTO check_in (user_id, datetime)
         VALUES ($1, CURRENT_TIMESTAMP)`,
        [user.user_id]
      );
    }

    return res.status(200).json({
      ok: decision !== "red",
      status: decision,
      message,
      user: {
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.member_status,
      },
    });
  } catch (error) {
    console.error("Check-in API error:", error);
    return res.status(500).json({
      ok: false,
      status: "red",
      error: "Internal server error during check-in",
      details: error.message,
    });
  }
}
