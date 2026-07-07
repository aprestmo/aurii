import { describe, expect, it } from "bun:test";

import { compareGeoIds, formatOrgNumber } from "../lib/format";

describe("formatOrgNumber", () => {
  it("formats nine-digit organisation numbers as 3+3+3", () => {
    expect(formatOrgNumber("974587815")).toBe("974 587 815");
  });

  it("strips non-digits before formatting", () => {
    expect(formatOrgNumber("974 587 815")).toBe("974 587 815");
  });

  it("returns em dash for empty values", () => {
    expect(formatOrgNumber(undefined)).toBe("—");
    expect(formatOrgNumber(null)).toBe("—");
    expect(formatOrgNumber("")).toBe("—");
  });

  it("returns original value when not nine digits", () => {
    expect(formatOrgNumber("U123")).toBe("U123");
  });
});

describe("compareGeoIds", () => {
  it("sorts geographic ids numerically", () => {
    expect(compareGeoIds("03", "11")).toBeLessThan(0);
    expect(compareGeoIds("0301", "1101")).toBeLessThan(0);
    expect(compareGeoIds("11", "03")).toBeGreaterThan(0);
  });
});
