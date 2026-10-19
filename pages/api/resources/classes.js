import { getSessionUser } from "@/lib/session";
import { loadClasses } from "@/lib/resources";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to view classes." });
  try {
    // Full classes come back unavailable, except ones this user is already enrolled in
    return res.status(200).json({ classes: await loadClasses({ userId: user.user_id }) });
  } catch (error) {
    console.error("Load classes error:", error);
    return res.status(500).json({ error: "Could not load classes." });
  }
}
