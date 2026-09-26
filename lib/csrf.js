// CSRF protection via the double-submit cookie pattern.
//
// Why this works: the session cookie is httpOnly (JS can't read it), but a
// cross-site page can still make the browser *send* it automatically, which
// is exactly what CSRF exploits. To block that, every state-changing request
// must also echo a token back in a custom header. A cross-origin attacker
// page can trigger a request but can't read our cookie (browser same-origin
// policy) or our JSON responses, so it can never learn the token to put in
// that header. The csrf cookie itself is intentionally NOT httpOnly, since
// the frontend JS needs to read it to set the header.

import crypto from "crypto";
import { serialize, parse } from "cookie";

const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString("hex");

  res.setHeader(
    "Set-Cookie",
    serialize(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600, // 1 hour
    })
  );

  return token;
}

export function verifyCsrfToken(req) {
  const cookies = parse(req.headers.cookie || "");
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || typeof headerToken !== "string") {
    return false;
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (cookieBuf.length !== headerBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(cookieBuf, headerBuf);
}
