import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query("SELECT NOW() AS now");
    return Response.json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
