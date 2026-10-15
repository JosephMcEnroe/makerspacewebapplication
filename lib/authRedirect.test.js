import { describe, expect, it } from "vitest";
import { getPostLoginDestination } from "./authRedirect";

describe("getPostLoginDestination", () => {
  it("returns a valid local destination, including its query string", () => {
    expect(getPostLoginDestination("/reservations?type=rooms", "member")).toBe("/reservations?type=rooms");
  });

  it.each(["https://attacker.example", "//attacker.example/path", "/login?next=/account", "invalid path"])(
    "uses the role destination rather than the unsafe path %s",
    (path) => {
      expect(getPostLoginDestination(path, "admin")).toBe("/admin");
    }
  );

  it("uses each role's home page when no destination was requested", () => {
    expect(getPostLoginDestination(undefined, "staff")).toBe("/staff");
    expect(getPostLoginDestination(undefined, "member")).toBe("/dashboard");
  });
});
