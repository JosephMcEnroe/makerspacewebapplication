import { query } from "@/lib/db";
import { authenticateReader } from "@/lib/rfidAccess";
import { usageRepository } from "@/Data_Access_Layer/usageRepository";

// Front-door RFID reader. The first tap of the day checks a member in, the next
// tap checks them out (see usageRepository.recordDoorTap).
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

  // 1. Authenticate the reader: Authorization: Bearer MAKERSPACE_API_KEY
  if (!authenticateReader(req, res)) return;

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
          m.status AS member_status,
          m.role_of_membership
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
    const memberStatus = (user.member_status || "").toLowerCase().trim();

    // 4. Only active members get in. Default to red so an unknown/null
    // membership status cannot accidentally grant access.
    if (memberStatus !== "active") {
      return res.status(200).json({
        ok: false,
        status: "red",
        message: memberStatus === "inactive"
          ? "Access denied: membership is inactive"
          : "Access denied: membership is not active",
      });
    }

    // 5. Record the visit in check_in_history (and the latest check-in in check_in)
    const action = await new usageRepository().recordDoorTap(user.user_id);

    // 6. Return result to Raspberry Pi
    return res.status(200).json({
      ok: true,
      status: "green",
      action,
      message: action === "checked_out" ? "Checked out. See you next time!" : "Access granted",
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
    });
  }
}
