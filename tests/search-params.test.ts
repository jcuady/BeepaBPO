import { describe, expect, it } from "vitest";
import {
  dateParam,
  enumParam,
  ilikePattern,
  sanitizeIlike,
  stringParam,
} from "@/lib/app/search-params";

describe("search-params", () => {
  it("stringParam trims and falls back", () => {
    expect(stringParam("  hi  ")).toBe("hi");
    expect(stringParam(undefined, "x")).toBe("x");
    expect(stringParam(["a", "b"])).toBe("a");
  });

  it("enumParam allows only listed values", () => {
    const allowed = ["pending", "approved"] as const;
    expect(enumParam("pending", allowed)).toBe("pending");
    expect(enumParam("nope", allowed)).toBeUndefined();
    expect(enumParam("", allowed, "pending")).toBe("pending");
  });

  it("dateParam accepts yyyy-MM-dd only", () => {
    expect(dateParam("2026-09-06")).toBe("2026-09-06");
    expect(dateParam("09/06/2026")).toBeUndefined();
  });

  it("sanitizeIlike strips wildcards", () => {
    expect(sanitizeIlike("a%b_c,d")).toBe("abcd");
    expect(ilikePattern("hi")).toBe("%hi%");
    expect(ilikePattern("%")).toBeUndefined();
  });
});
