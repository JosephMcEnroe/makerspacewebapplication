import { query } from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await query("SELECT NOW() AS now");
    return res.status(200).json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}

