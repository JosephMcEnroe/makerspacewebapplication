import { Pool } from "pg";

function needsSSL(connectionString) {
  const host = new URL(connectionString).hostname;
  return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".railway.internal");
}

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString,
      ssl: needsSSL(connectionString) ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}
