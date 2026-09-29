// Minimal in-memory rate limiter (fixed window per key).
//
// NOTE: this state lives in the Node process's memory. It resets on
// redeploy/restart and is NOT shared across multiple server instances. That's
// fine for a single-instance deployment; if this app ever runs on multiple
// instances/serverless replicas behind a load balancer, replace this with a
// shared store (e.g. Redis) so limits apply globally.

const buckets = new Map();

// Opportunistic cleanup so the map doesn't grow unbounded.
function sweep(now) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

/**
 * @param {string} key unique identifier for the caller+action (e.g. `login:1.2.3.4`)
 * @param {number} limit max requests allowed per window
 * @param {number} windowMs window size in milliseconds
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Best-effort client identifier behind proxies/load balancers.
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
