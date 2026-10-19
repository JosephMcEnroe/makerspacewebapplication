import { describe, expect, it } from "vitest";
import { canReserve } from "./reservationAccess";

describe("reservation access", () => {
  it.each([
    [{ status: "ACTIVE", role_of_membership: "MEMBER" }, true],
    [{ status: "active", role: "MEMBER" }, true],
    [{ status: "INACTIVE", role_of_membership: "STAFF" }, true],
    [{ status: "INACTIVE", role: " admin " }, true],
    [{ status: "INACTIVE", role_of_membership: "MEMBER" }, false],
    [{ status: null, role_of_membership: null }, false],
    [null, false],
  ])("%j -> %s", (user, expected) => {
    expect(canReserve(user)).toBe(expected);
  });
});
