import { timingSafeEqual } from "node:crypto";
import { recoverEquipmentRefunds } from "@/lib/equipmentRefundService";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  try { return res.status(200).json({ results: await recoverEquipmentRefunds() }); }
  catch (error) { console.error("Refund recovery unavailable:", error.message); return res.status(500).json({ error: "Recovery unavailable" }); }
}
