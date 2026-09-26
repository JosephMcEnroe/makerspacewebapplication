// Server-side input validation & sanitization for auth endpoints.
// Defense in depth: the DB layer already uses parameterized queries and React
// escapes output, but rejecting malformed/hostile input here keeps bad data
// out of the database and out of logs in the first place.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Letters (incl. accented), marks, spaces, hyphens and apostrophes only.
// Blocks HTML/script payloads and SQL metacharacters from ever reaching
// the database or being echoed back to a page.
const NAME_REGEX = /^[\p{L}\p{M} '-]{1,50}$/u;

export function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length > 0 &&
    email.length <= 254 &&
    EMAIL_REGEX.test(email)
  );
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Password policy for account creation. Login only enforces a max length
// (to avoid hashing/DoS on absurd input) since existing accounts may predate
// the policy.
export function isValidNewPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

export function isValidLoginPassword(password) {
  return typeof password === "string" && password.length > 0 && password.length <= 128;
}

// Returns the trimmed name if it passes the allow-list, otherwise null.
export function sanitizeName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}
