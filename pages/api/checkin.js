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

  // 1. Authenticate with Bearer token
  // Authorization: Bearer APIKEY
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

  // 2. Get RFID card ID from request body
  const { card_id } = req.body || {};

  if (!card_id || typeof card_id !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Missing or invalid card_id in request body",
    });
  }

  const normalizedCardId = card_id.toLowerCase().trim();

  try {
    // 3. Find membership by RFID and join it to the associated user
    const userResult = await query(
      `SELECT
          u.user_id,
          u.first_name,
          u.last_name,
          u.email,
          u.waiver_status,
          m.membership_id,
          m.rfid_id,
          m.status AS member_status,
          m.role_of_membership,
          m.period_start_date,
          m.period_end_date
       FROM membership m
       JOIN users u ON u.user_id = m.user_id
       WHERE LOWER(m.rfid_id::text) = LOWER($1::text)`,
      [normalizedCardId]
    );

    // No membership has this RFID card
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        ok: false,
        status: "red",
        message: "Unknown card or unregistered user",
      });
    }

    const user = userResult.rows[0];

    const memberStatus = (user.member_status || "")
      .toLowerCase()
      .trim();

    // 4. Determine traffic light decision
    //
    // ACTIVE   -> Green
    // INACTIVE -> Red
    //
    // Default to red so an unknown/null membership status
    // cannot accidentally grant access.
    let decision = "red";
    let message = "Access denied: membership is not active";

    if (memberStatus === "active") {
      decision = "green";
      message = "Access granted";
    } else if (memberStatus === "inactive") {
      decision = "red";
      message = "Access denied: membership is inactive";
    }

    // 5. Record successful check-in
    //
    // last_check_in no longer exists in users.
    // The check_in table is now the source of truth
    // for each user's latest successful check-in.
    if (decision === "green") {
      await query(
        `INSERT INTO check_in (user_id, datetime)
         VALUES ($1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET datetime = EXCLUDED.datetime`,
        [user.user_id]
      );
    }

    // 6. Return result to Raspberry Pi
    return res.status(200).json({
      ok: decision === "green",
      status: decision,
      message,
      user: {
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.member_status,
        role: user.role_of_membership,
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
