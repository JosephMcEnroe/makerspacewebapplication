import { describe, it, expect, vi } from "vitest";
import { loadRooms } from "@/lib/resources";

vi.mock("@/lib/stripeCatalog", () => ({ loadStripeProducts: vi.fn(() => { throw Error("Stripe unavailable"); }), matchResourceProduct: vi.fn() }));
vi.mock("@/Data_Access_Layer/roomRepository", () => ({ roomRepository: class {
  async findAllRoom() { return [{ room_id: 1, name: "Small studio", type: "Studio", stripe_room_id: null }]; }
} }));
vi.mock("@/Data_Access_Layer/roomReservationRepository", () => ({ roomReservationRepository: class {
  async findAllRoomReservation() { return [
    { room_id: 1, reservation_id: 10, start_date: "2026-10-20T00:00:00", end_date: "2026-11-20T00:00:00", status: "upcoming" },
    { room_id: 1, reservation_id: 11, status: "cancelled" },
  ]; }
} }));

describe("database room catalog", () => {
  it("renders unmapped rooms independently of Stripe and keeps active availability", async () => {
    const rooms = await loadRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ resourceId: "1", name: "Small studio", image: expect.stringContaining("/images/") });
    expect(rooms[0].unavailable).toBeUndefined();
    expect(rooms[0].product).toBeUndefined();
    expect(rooms[0].unavailableIntervals).toHaveLength(1);
  });
});
