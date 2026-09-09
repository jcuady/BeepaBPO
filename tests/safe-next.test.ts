import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("allows same-origin paths", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/my/leave")).toBe("/app/my/leave");
  });

  it("rejects protocol-relative and backslash URLs", () => {
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
  });

  it("rejects auth paths that would loop", () => {
    expect(safeNext("/login")).toBe("/app");
    expect(safeNext("/signup")).toBe("/app");
    expect(safeNext("/employee/login")).toBe("/app");
    expect(safeNext("/forgot-password")).toBe("/app");
  });

  it("falls back for empty values", () => {
    expect(safeNext(null)).toBe("/app");
    expect(safeNext(undefined, "/login")).toBe("/login");
  });
});
