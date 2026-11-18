import { getOperations } from "@/Data_Access_Layer/operationsRepository";
import { getStaffSession } from "@/lib/staffAuth";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getStaffSession(req);
    if (!session) return res.status(401).json({ error: "Sign in to continue." });
    if (!session.isAdmin) return res.status(403).json({ error: "Admin access required." });

    return res.status(200).json(await getOperations());
  } catch (error) {
    console.error("Load operations error:", error);
    return res.status(500).json({ error: "Could not load operations data." });
  }
}
