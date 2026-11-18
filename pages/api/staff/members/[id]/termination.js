import { findLatestTermination } from "@/Data_Access_Layer/bannedRepository";
import { requireStaffApi } from "@/lib/staffAuth";
import { terminationPhotoType } from "@/lib/terminationPhoto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  if (!(await requireStaffApi(req, res))) return;

  const memberId = Number(req.query.id);
  if (!Number.isSafeInteger(memberId) || memberId < 1) {
    return res.status(400).json({ error: "Invalid member." });
  }

  let record;
  try {
    record = await findLatestTermination(memberId);
  } catch (error) {
    console.error("Could not load termination details:", error);
    return res.status(500).json({ error: "Could not load termination details." });
  }
  if (!record) return res.status(404).json({ error: "No termination record was found." });
  const type = terminationPhotoType(record.photo);

  if (req.query.photo === "1") {
    if (!type) return res.status(404).end();
    res.setHeader("Content-Type", type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(record.photo);
  }

  return res.status(200).json({
    reason: record.reason?.trim() || "No reason recorded",
    photoUrl: type ? `/api/staff/members/${memberId}/termination?photo=1` : null,
  });
}
