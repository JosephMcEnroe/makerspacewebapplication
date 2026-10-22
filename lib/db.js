import { Pool, types } from "pg";
import { businessTime } from "./businessTime";

function needsSSL(connectionString) {
  const host = new URL(connectionString).hostname;
  return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".railway.internal");
}

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const dbURL = new URL(connectionString);

    console.log("DB HOST:", dbURL.hostname);
    console.log("DB NAME:", dbURL.pathname);

    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString,
      // Parse timezone-free Postgres values consistently on every host.
      types: { getTypeParser(oid, format) {
        if (format !== "binary" && (oid === 1114 || oid === 1082)) return value => new Date(businessTime(value));
        return types.getTypeParser(oid, format);
      } },
      options: "-c timezone=America/New_York",
      // The DB is remote (~650ms to open a connection), so keep idle
      // connections around instead of pg's 10s default
      idleTimeoutMillis: 5 * 60 * 1000,
      keepAlive: true,
      ssl: needsSSL(connectionString) ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export function query(text, params = []) {
  return getPool().query(text, params);
}
