import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../components/MonthlyAvailability.js", import.meta.url), "utf8");

describe("monthly availability booking UI", () => {
  it("offers direct month selection without asking for a rental month count", () => {
    expect(source).toContain("Select rental months");
    expect(source).toContain("Choose up to 12 available months.");
    expect(source).toContain("const finalVisibleMonth = maxMonth;");
    expect(source).toMatch(/monthAvailability\.map\(\(\{ month: availableMonth, available, status \}\)/);
    expect(source).toMatch(/<button[^>]*aria-pressed=\{selected\}[^>]*onClick=\{\(\) => toggleMonth\(availableMonth\)\}/);
    expect(source).not.toContain("Number of months");
    expect(source).not.toContain('type="month"');
    expect(source).not.toContain("<select");
  });
});
