import { verifyCsrfToken } from "@/lib/csrf";
import { requireStaffApi } from "@/lib/staffAuth";
import { trainingRepository } from "@/Data_Access_Layer/trainingRepository";

const DECISIONS = { approve: "APPROVED", deny: "DENIED" };

// Staff approves or denies a member's pending equipment training
export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireStaffApi(req, res);
  if (!session) return;
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const trainingId = Number(req.query.id);
  if (!Number.isInteger(trainingId) || trainingId < 1) return res.status(400).json({ error: "Invalid training." });

  const status = DECISIONS[req.body?.decision];
  if (!status) return res.status(400).json({ error: "Choose approve or deny." });

  try {
    const record = await new trainingRepository().review(trainingId, status, session.user.user_id);
    if (!record) return res.status(409).json({ error: "This training was already reviewed or no longer exists." });
    return res.status(200).json({ ok: true, training: { id: record.training_id, status: record.status } });
  } catch (error) {
    console.error("Training review error:", error);
    return res.status(500).json({ error: "Could not save the review." });
  }
}
