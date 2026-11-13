import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { getTrainingModule } from "@/lib/trainingContent";
import { trainingRepository } from "@/Data_Access_Layer/trainingRepository";

// Member confirms they completed an equipment training module; staff review it
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to complete training." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { equipmentKey, confirmed } = req.body || {};
  if (!getTrainingModule(equipmentKey)) return res.status(400).json({ error: "Choose a valid training." });
  if (confirmed !== true) {
    return res.status(400).json({ error: "Confirm that you completed the training." });
  }

  try {
    const record = await new trainingRepository().submit(user.user_id, equipmentKey);
    if (!record) {
      return res.status(409).json({ error: "This training is already submitted or approved." });
    }
    return res.status(200).json({ ok: true, training: { status: record.status } });
  } catch (error) {
    console.error("Training submission error:", error);
    return res.status(500).json({ error: "Could not save your training. Please try again." });
  }
}
