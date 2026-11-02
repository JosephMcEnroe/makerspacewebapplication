import { requireStaffApi } from "@/lib/staffAuth";
import { usageRepository } from "@/Data_Access_Layer/usageRepository";

// Live check-in and machine/room usage for the staff and admin dashboards (polled)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireStaffApi(req, res))) return;
  res.setHeader("Cache-Control", "no-store");

  try {
    const usage = new usageRepository();
    const [live, stats] = await Promise.all([usage.getLiveActivity(), usage.getUsageStats()]);
    return res.status(200).json({ ...live, ...stats, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Load activity error:", error);
    return res.status(500).json({ error: "Could not load activity." });
  }
}
