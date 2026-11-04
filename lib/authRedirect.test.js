import { describe, expect, it } from "vitest";
import { getPostLoginDestination } from "./authRedirect";

describe("post-login destination", () => {
  it("sends each role to its own landing page", () => {
    expect(getPostLoginDestination(null, "ADMIN")).toBe("/admin");
    expect(getPostLoginDestination(null, "STAFF")).toBe("/staff");
    expect(getPostLoginDestination(null, "INSTRUCTOR")).toBe("/instructor");
    expect(getPostLoginDestination(null, "MEMBER")).toBe("/dashboard");
    expect(getPostLoginDestination(null, "")).toBe("/dashboard");
  });

  it("treats anyone in the instructor table as an instructor", () => {
    expect(getPostLoginDestination(null, "", { isInstructor: true })).toBe("/instructor");
    expect(getPostLoginDestination(null, "MEMBER", { isInstructor: true })).toBe("/instructor");
  });

  it("keeps staff and admin pages ahead of the instructor dashboard", () => {
    expect(getPostLoginDestination(null, "STAFF", { isInstructor: true })).toBe("/staff");
    expect(getPostLoginDestination(null, "ADMIN", { isInstructor: true })).toBe("/admin");
  });

  it("still honours an explicit local destination", () => {
    expect(getPostLoginDestination("/instructor?tab=past", "MEMBER")).toBe("/instructor?tab=past");
    expect(getPostLoginDestination("/login?next=%2Frooms", "INSTRUCTOR")).toBe("/instructor");
    expect(getPostLoginDestination("https://example.com/x", "INSTRUCTOR")).toBe("/instructor");
  });
});
