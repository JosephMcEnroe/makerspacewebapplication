import { query } from "@/lib/db";

export async function loadReportMappings() {
  const [machines, rooms] = await Promise.all([
    query('SELECT machine_id, type, stripe_machine_id FROM "machine"'),
    query('SELECT room_id, type, stripe_room_id FROM "room"'),
  ]);
  return { machines: machines.rows, rooms: rooms.rows };
}
