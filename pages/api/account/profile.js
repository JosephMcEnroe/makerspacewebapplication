import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Member saves the personal information form on their own account page
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ error: "Sign in to update your account information." });
  }
  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }

  const body = req.body || {};
  const readText = (value) => (typeof value === "string" ? value.trim() : "");

  const firstName = readText(body.firstName);
  const lastName = readText(body.lastName);
  const email = readText(body.email);
  const phoneNumber = readText(body.phoneNumber);
  const dateOfBirth = readText(body.dateOfBirth);

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "First and last name are required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (dateOfBirth && !DATE_PATTERN.test(dateOfBirth)) {
    return res.status(400).json({ error: "Enter a valid date of birth." });
  }

  try {
    const updated = await new UserRepository().updateAccountProfile(sessionUser.user_id, {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth || null,
      email,
      phone_number: phoneNumber || null,
    });

    if (!updated) {
      return res.status(404).json({ error: "Account not found." });
    }

    const date = updated.date_of_birth;
    const dateValue = date
      ? (date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10))
      : "";

    return res.status(200).json({
      ok: true,
      account: {
        firstName: updated.first_name ?? "",
        lastName: updated.last_name ?? "",
        dateOfBirth: dateValue,
        email: updated.email ?? "",
        phoneNumber: updated.phone_number ?? "",
      },
    });
  } catch (error) {
    // Unique violation on the email column
    if (error?.code === "23505") {
      return res.status(409).json({ error: "That email address is already in use." });
    }
    console.error("Account update error:", error);
    return res.status(500).json({ error: "Could not save your account information. Please try again." });
  }
}
