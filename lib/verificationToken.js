import crypto from "crypto";

// Signed, expiring email-verification tokens. The token carries the user id
// and email it was issued for, signed with EMAIL_VERIFICATION_SECRET, so no
// token table is needed - and a token stops working if the email changes.
// It also carries a fingerprint of the password hash, so when someone signs up
// again over an unverified account, links sent for the old password stop working.

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret() {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error("EMAIL_VERIFICATION_SECRET is not set");
  }
  return secret;
}

// Short fingerprint of the stored password hash (never the hash itself)
export function passwordFingerprint(passwordHash) {
  return crypto.createHmac("sha256", getSecret()).update(String(passwordHash)).digest("base64url").slice(0, 16);
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createVerificationToken(userId, email, passwordHash) {
  const payload = Buffer.from(
    JSON.stringify({ userId, email, pwd: passwordFingerprint(passwordHash), exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

// Returns { userId, email, pwd } for a valid, unexpired token, otherwise null
export function readVerificationToken(token) {
  if (typeof token !== "string") return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const { userId, email, pwd, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!userId || !email || !pwd || typeof exp !== "number" || exp < Date.now()) {
      return null;
    }
    return { userId, email, pwd };
  } catch {
    return null;
  }
}
