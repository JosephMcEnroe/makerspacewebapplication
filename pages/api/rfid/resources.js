import { query } from "@/lib/db";
import { authenticateReader } from "@/lib/rfidAccess";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  if (!authenticateReader(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const mode = req.query.mode;
  if (!["equipment", "studio"].includes(mode)) {
    return res.status(400).json({ error: "Choose equipment or studio" });
  }
  try {
    const result = await query(mode === "equipment"
      ? "SELECT machine_id AS id, name, type FROM machine ORDER BY name, machine_id"
      : "SELECT room_id AS id, name, type FROM room ORDER BY name, room_id");
    return res.status(200).json({ resources: result.rows });
  } catch (error) {
    console.error("RFID resource listing failed:", error);
    return res.status(500).json({ error: "Could not load resources" });
  }
}
