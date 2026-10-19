import { verifyCsrfToken } from "@/lib/csrf";
import { requireStaffApi } from "@/lib/staffAuth";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";
import { membershipRepositry } from "@/Data_Access_Layer/MembershipRepository";
import { adminRepository } from "@/Data_Access_Layer/adminRepository";

const ROLES = ["MEMBER", "STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"];
const STATUSES = ["ACTIVE", "INACTIVE"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Staff updates a member's profile and membership
export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireStaffApi(req, res);
  if (!session) return;
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const memberId = Number(req.query.id);
  if (!Number.isInteger(memberId) || memberId < 1) return res.status(400).json({ error: "Invalid member." });

  const users = new UserRepository();
  const memberships = new membershipRepositry();
  const [existingUser, existingMembership, targetIsAdmin] = await Promise.all([
    users.findById(memberId),
    memberships.findUserMembership(memberId),
    new adminRepository().isAdmin(memberId),
  ]);
  if (!existingUser) return res.status(404).json({ error: "Member not found." });
  // Staff can't edit admin accounts or hand out roles — only admins can
  if (targetIsAdmin && !session.isAdmin) {
    return res.status(403).json({ error: "Only admins can edit admin accounts." });
  }

  const { user: userInput, membership: membershipInput } = req.body || {};

  try {
    let updatedUser = existingUser;
    if (userInput) {
      const details = {
        first_name: text(userInput.first_name, 100),
        last_name: text(userInput.last_name, 100),
        phone_number: text(userInput.phone_number, 30) || null,
        email: text(userInput.email, 255).toLowerCase(),
        notes: text(userInput.notes, 2000) || null,
        waiver_status: userInput.waiver_status === true,
      };
      if (!details.first_name || !details.last_name) return res.status(400).json({ error: "First and last name are required." });
      if (!EMAIL_PATTERN.test(details.email)) return res.status(400).json({ error: "Enter a valid email address." });
      updatedUser = await users.updateUserDetails(memberId, details);
    }

    let updatedMembership = existingMembership;
    if (membershipInput) {
      const role = session.isAdmin
        ? membershipInput.role_of_membership
        : existingMembership?.role_of_membership || "MEMBER";
      const details = {
        role_of_membership: role,
        status: membershipInput.status,
        period_start_date: membershipInput.period_start_date,
        period_end_date: membershipInput.period_end_date,
        rfid_id: text(membershipInput.rfid_id, 64) || null,
      };
      if (!ROLES.includes(details.role_of_membership)) return res.status(400).json({ error: "Choose a valid role." });
      if (!STATUSES.includes(details.status)) return res.status(400).json({ error: "Choose a valid status." });
      if (!DATE_PATTERN.test(details.period_start_date || "") || !DATE_PATTERN.test(details.period_end_date || "")) {
        return res.status(400).json({ error: "Enter valid membership start and end dates." });
      }
      if (details.period_end_date < details.period_start_date) {
        return res.status(400).json({ error: "The membership end date must be after the start date." });
      }
      updatedMembership = await memberships.saveMembershipForUser(memberId, details);
    }

    return res.status(200).json({ ok: true, user: updatedUser, membership: updatedMembership });
  } catch (error) {
    if (error.code === "23505") {
      const field = String(error.constraint || "").includes("rfid") ? "RFID card" : "email";
      return res.status(409).json({ error: `That ${field} is already used by another account.` });
    }
    console.error("Staff member update error:", error);
    return res.status(500).json({ error: "Could not save the member." });
  }
}
