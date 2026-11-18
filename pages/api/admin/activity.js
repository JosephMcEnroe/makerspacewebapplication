import { getStaffSession } from "@/lib/staffAuth";
import {
  activityRepository,
  ACTIVITY_RANGES,
  STATUS_FILTERS,
} from "@/Data_Access_Layer/activityRepository";

// Live activity + card log for the admin dashboard (polled by /admin/activity).
// GET /api/admin/activity?range=hour|day&status=all|granted|denied
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStaffSession(req);
  if (!session) return res.status(401).json({ error: "Sign in to continue." });
  if (!session.isAdmin) return res.status(403).json({ error: "Admin access required." });

  const range = req.query.range || "hour";
  const status = req.query.status || "all";
  if (!ACTIVITY_RANGES[range]) {
    return res.status(400).json({ error: "range must be hour or day" });
  }
  if (!STATUS_FILTERS.includes(status)) {
    return res.status(400).json({ error: "status must be all, granted, or denied" });
  }

  res.setHeader("Cache-Control", "no-store");
  try {
    const activity = await new activityRepository().getActivity(range, status);
    return res.status(200).json({ ...activity, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Load activity error:", error);
    return res.status(500).json({ error: "Could not load activity." });
  }
}
