import { afterEach, beforeEach, expect, it, vi } from "vitest";
import create from "../pages/api/reservations/create";
import enroll from "../pages/api/reservations/class";
import update from "../pages/api/reservations/update";
import updateClass from "../pages/api/reservations/update-class";
import checkin from "../pages/api/checkin";
import { resourceCheckin } from "./rfidAccess";

const { user, query, connect, enrollUserInClass } = vi.hoisted(() => ({ user: vi.fn(), query: vi.fn(), connect: vi.fn(), enrollUserInClass: vi.fn() }));
vi.mock("./session", () => ({ getSessionUser: user, WAIVER_REQUIRED: { code: "WAIVER_REQUIRED" } }));
vi.mock("./csrf", () => ({ verifyCsrfToken: () => true }));
vi.mock("./db", () => ({ query, getPool: () => ({ connect }) }));
vi.mock("./reservationService", () => ({ enrollUserInClass }));
const res = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T17:00:00Z"));
  vi.stubEnv("MAKERSPACE_API_KEY", "test_reader_key");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it.each([create, enroll, update, updateClass])("blocks inactive members before creating or changing a reservation", async handler => {
  user.mockResolvedValue({ user_id: 18, status: "INACTIVE", waiver_status: true });
  const response = res();
  await handler({ method: "POST", headers: {}, body: {} }, response);
  expect(response.status).toHaveBeenCalledWith(403);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "MEMBERSHIP_REQUIRED" }));
  expect(query).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
  expect(enrollUserInClass).not.toHaveBeenCalled();
});

it("blocks an expired day pass before checkout even if its status is ACTIVE", async () => {
  user.mockResolvedValue({ user_id: 18, status: "ACTIVE", period_end_date: "2026-11-14", waiver_status: true });
  const response = res();
  await create({ method: "POST", body: {} }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "MEMBERSHIP_REQUIRED" }));
});

it("allows class enrollment beyond the current membership's end", async () => {
  user.mockResolvedValue({ user_id: 18, status: "ACTIVE", period_end_date: "2026-11-15", waiver_status: true });
  enrollUserInClass.mockResolvedValue({ status: 201, body: { reservationIds: [7] } });
  const response = res();
  await enroll({ method: "POST", body: { resourceId: 100 } }, response);
  expect(enrollUserInClass).toHaveBeenCalledWith({ userId: 18, classId: 100 });
  expect(response.status).toHaveBeenCalledWith(201);
});

it.each([checkin, resourceCheckin("equipment"), resourceCheckin("studio")])("denies expired membership at RFID access", async handler => {
  query.mockResolvedValue({ rows: [{ user_id: 18, member_status: "ACTIVE", period_end_date: "2026-11-14" }] });
  const response = res();
  await handler({ method: "POST", headers: { authorization: "Bearer test_reader_key" }, body: { card_id: "card", resource_id: 1 } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: "red" }));
  expect(query).toHaveBeenCalledTimes(1);
});

it.each(["equipment", "studio"])("grants %s access after renewal when the reservation exists", async mode => {
  query.mockResolvedValueOnce({ rows: [{ user_id: 18, member_status: "ACTIVE", period_start_date: "2026-11-15", period_end_date: "2026-12-15" }] })
    .mockResolvedValueOnce({ rows: [{ exists: true }] });
  const response = res();
  await resourceCheckin(mode)({ method: "POST", headers: { authorization: "Bearer test_reader_key" }, body: { card_id: "card", resource_id: 1 } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, status: "green" }));
});
