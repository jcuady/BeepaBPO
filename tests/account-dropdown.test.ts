import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account dropdown menu", () => {
  const menu = readFileSync(
    join(process.cwd(), "components/ui/dropdown-menu.tsx"),
    "utf8",
  );
  const header = readFileSync(
    join(process.cwd(), "components/app/app-header.tsx"),
    "utf8",
  );

  it("DropdownMenuLabel provides Menu.Group context for GroupLabel", () => {
    expect(menu).toContain("MenuPrimitive.GroupLabel");
    expect(menu).toContain("MenuPrimitive.Group");
    expect(menu).toMatch(
      /function DropdownMenuLabel[\s\S]*MenuPrimitive\.Group[\s\S]*MenuPrimitive\.GroupLabel/,
    );
  });

  it("header account menu exposes profile settings and sign out", () => {
    expect(header).toContain("DropdownMenuLabel");
    expect(header).toContain("Sign out");
    expect(header).toContain("Settings");
    expect(header).toContain("Profile");
    expect(header).toContain("logoutAction");
    expect(header).toContain("aria-label=\"Account menu\"");
  });
});
