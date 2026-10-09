import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The design-system gate and the primitive it exists to protect.
 *
 * `scripts/audit-design-system.mjs` was written after the first sweep found 26
 * dropdowns across 22 files that had each drifted to a different radius and
 * background, and — the part that actually mattered — none of which had a focus
 * ring, because they were raw `<select>` elements rather than the primitive.
 *
 * An auditor that cannot fail is worse than no auditor, because it is trusted.
 * So the first half of this file runs the real script against throwaway
 * fixtures that each violate exactly one rule, and asserts it *fails*. A gate
 * that passes those fixtures is not a gate.
 */

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "audit-design-system.mjs");

function runAudit(cwd: string) {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

/** Build a minimal app/ + components/ tree and audit it. */
function auditFixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "design-audit-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const full = join(dir, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body, "utf8");
    }
    return runAudit(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A tree with nothing wrong in it. Selects live in `components/ui/`, as they must. */
const CLEAN = {
  "app/page.tsx": `export default function P() {
  return <div className="bg-mist text-navy" />;
}`,
  "components/ui/native-select.tsx": `export const NativeSelect = () => <select />;`,
};

describe("design-system auditor — negative controls", () => {
  it("passes a clean tree", () => {
    const r = auditFixture(CLEAN);
    expect(r.out).toContain("VERDICT: no raw primitives and no hardcoded colours.");
    expect(r.status).toBe(0);
  });

  it("FAILS a raw <select> outside components/ui", () => {
    // The exact defect that started this: 26 hand-rolled dropdowns.
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <select name="status" className="rounded-[10px]" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("RAW PRIMITIVE USAGE");
    expect(r.out).toContain("components/ui/native-select.tsx");
    expect(r.out).toContain("app/page.tsx");
  });

  it("FAILS a raw <table> outside components/ui", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <table><tbody /></table>;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("components/ui/table.tsx");
  });

  it("FAILS a hardcoded colour literal", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <div className="bg-[#F5F7F6]" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("HARDCODED COLOURS");
  });

  it("FAILS an rgba() literal too, not just hex", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <div style={{ background: "rgba(17, 148, 70, 0.2)" }} />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("HARDCODED COLOURS");
  });

  it("does not count violations that only appear in comments", () => {
    // Otherwise this script's own documentation of the drift would fail it.
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `// previously a raw <select> with bg-[#123456]
/* and a <table> too */
export default function P() {
  return <div className="bg-mist" />;
}`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("VERDICT: no raw primitives");
  });

  it("exempts components/ui itself from the primitive rule", () => {
    // The primitives legitimately contain the elements they wrap.
    const r = auditFixture({
      "components/ui/native-select.tsx": `export const X = () => <select />;`,
      "components/ui/table.tsx": `export const Y = () => <table />;`,
      "app/page.tsx": `export default function P() { return <div />; }`,
    });
    expect(r.status).toBe(0);
  });

  // ---- input / textarea / button, added to the rule 2026-10-09 ----
  //
  // The gate previously covered only <select> and <table>, so its verdict line
  // "no raw primitives" meant something much narrower than it read. These
  // cases pin the widened rule AND the two exemptions that keep it from
  // flagging correct code.

  it("FAILS a raw <input> outside components/ui", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <input type="date" className="min-h-11 rounded-[12px]" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("RAW PRIMITIVE USAGE");
    expect(r.out).toContain("components/ui/input.tsx");
  });

  it("FAILS a raw <button> outside components/ui", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <button type="button" className="px-2" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("components/ui/button.tsx");
  });

  it("FAILS a raw <textarea> outside components/ui", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <textarea className="min-h-11" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("components/ui/textarea.tsx");
  });

  it("does NOT flag checkbox, radio or hidden inputs", () => {
    // `Input` is a text-field primitive. Running its h-8 rounded-lg px-2.5 over
    // a checkbox or a radio would break them, so these are correct code and the
    // first run of the widened rule reported three of them as violations.
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return (
    <>
      <input type="checkbox" className="size-4" />
      <input type="radio" name="x" className="size-4" />
      <input type="hidden" {...rest} />
      <input type="file" />
      <input type="range" />
    </>
  );
}`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("VERDICT: no raw primitives");
  });

  it("still flags a text input that carries no type attribute", () => {
    // No `type` means text, which `Input` does stand in for. Exempting an
    // untyped input would leave the most common case unguarded.
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <input name="q" className="h-8" />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("components/ui/input.tsx");
  });

  it("exempts serialized output (manifest, viewport) from the colour rule", () => {
    const r = auditFixture({
      ...CLEAN,
      "app/manifest.ts": `export default { theme_color: "#119446", background_color: "#ffffff" };`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("allowed");
    expect(r.out).toContain("app/manifest.ts");
  });

  it("reports arbitrary radii WITHOUT failing", () => {
    // Informational by design: a 130-site radius sweep needs visual review, so
    // the count is a progress metric. If this ever starts failing the gate,
    // the tool is making a decision it was explicitly told not to make.
    const r = auditFixture({
      ...CLEAN,
      "app/page.tsx": `export default function P() {
  return <div className="rounded-[7px] rounded-[13px] rounded-[7px]" />;
}`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("ARBITRARY RADIUS");
    expect(r.out).toContain("[informational]");
    expect(r.out).toContain("2 distinct value(s)");
    expect(r.out).toContain("3 use(s)");
    expect(r.out).toContain("off scale");
  });
});

describe("design-system auditor — live repo", () => {
  it("exits 0 on the working tree", () => {
    const r = runAudit(ROOT);
    expect(r.out).toMatch(/RAW PRIMITIVE USAGE\s+0/);
    expect(r.out).toMatch(/HARDCODED COLOURS\s+0/);
    expect(r.status).toBe(0);
  });
});

const PRIMITIVE = readFileSync(
  join(ROOT, "components", "ui", "native-select.tsx"),
  "utf8",
);
const INPUT = readFileSync(join(ROOT, "components", "ui", "input.tsx"), "utf8");
const BUTTON = readFileSync(join(ROOT, "components", "ui", "button.tsx"), "utf8");

describe("NativeSelect contract", () => {
  const cls = PRIMITIVE.match(/nativeSelectClassName = \[([\s\S]*?)\]\.join/)?.[1] ?? "";

  it("has a focus ring", () => {
    // The whole reason this primitive exists: none of the 26 raw dropdowns had
    // one, so keyboard users could not see where they were in a form.
    expect(cls).toContain("focus-visible:ring-3");
    expect(cls).toContain("focus-visible:ring-ring/50");
    expect(cls).toContain("focus-visible:border-ring");
  });

  it("carries the invalid-state treatment Input has", () => {
    expect(cls).toContain("aria-invalid:border-destructive");
    expect(cls).toContain("aria-invalid:ring-destructive/20");
  });

  it("carries the disabled-state treatment Input has", () => {
    expect(cls).toContain("disabled:cursor-not-allowed");
    expect(cls).toContain("disabled:opacity-50");
  });

  it("uses the radius scale, not an arbitrary value", () => {
    expect(cls).toContain("rounded-lg");
    expect(cls).not.toMatch(/rounded-\[\d+px\]/);
  });

  it("keeps the 44px coarse-pointer floor", () => {
    // Regression guard: the primitive shipped claiming it mirrored Input's
    // coarse-pointer height while omitting the class, leaving 32px dropdowns
    // next to 44px inputs on the phones this workforce actually uses.
    expect(cls).toContain("[@media(pointer:coarse)]:h-11");
    expect(INPUT).toContain("[@media(pointer:coarse)]:h-11");
  });

  it("keeps body copy readable on mobile", () => {
    expect(cls).toContain("text-base");
    expect(cls).toContain("md:text-sm");
    expect(INPUT).toContain("text-base");
  });

  it("hides the native arrow so desktop matches the design", () => {
    // The platform picker still opens on tap; only the drawn arrow is replaced.
    expect(cls).toContain("appearance-none");
    expect(cls).toContain("[&>option]:text-navy");
  });

  it("stays a native element so react-hook-form and mobile pickers keep working", () => {
    expect(PRIMITIVE).toMatch(/<select/);
    expect(PRIMITIVE).not.toMatch(/from\s+["']@\/components\/ui\/select["']/);
  });

  it("exports the class string so callers cannot fork the styling", () => {
    expect(PRIMITIVE).toContain("export const nativeSelectClassName");
    expect(PRIMITIVE).toContain("export function NativeSelect");
    expect(PRIMITIVE).toContain("export function NativeSelectCompact");
  });
});

describe("every other control already has the coarse-pointer floor", () => {
  it("Input and Button do", () => {
    expect(INPUT).toContain("[@media(pointer:coarse)]:h-11");
    expect(BUTTON).toContain("[@media(pointer:coarse)]:min-h-11");
  });
});

describe("Card does not impose a font size on its subtree", () => {
  const card = readFileSync(join(ROOT, "components", "ui", "card.tsx"), "utf8");
  // `data-slot="card"` is a prefix of `card-header` / `card-title` /
  // `card-description` / `card-footer`, so the negative lookahead is what keeps
  // this from quietly asserting against the wrong element.
  const wrapper =
    card.match(/data-slot="card"(?![\w-])[\s\S]*?className=\{cn\(\s*"([^"]+)"/)?.[1] ?? "";

  it("is readable on a phone and dense on a desktop", () => {
    // Regression guard. `Card` used to carry a bare `text-sm`, which set 14px on
    // every descendant that did not declare its own size. `CardTitle` already
    // compensated with `text-base`, so cards looked correct while plain `<p>`
    // elements inside them quietly violated the 16px-mobile rule. The auditor
    // only flags text of 25+ characters, so short values ("CloudPeak") hid it
    // through a full sweep.
    expect(wrapper).toContain("text-base");
    expect(wrapper).toContain("sm:text-sm");
  });

  it("does not set a bare text-sm that would win by inheritance", () => {
    // The exact regression. `text-sm sm:text-sm` would still render 14px on a
    // phone, so the presence of `sm:text-sm` alone proves nothing.
    const bare = wrapper.match(/(?<!sm:)text-sm(?![\w-])/g) ?? [];
    expect(bare).toEqual([]);
  });

  it("leaves CardTitle and CardDescription explicit", () => {
    // The children that already declared a size must keep declaring it, or this
    // change would silently alter them too.
    expect(card).toMatch(/data-slot="card-title"(?![\w-])[\s\S]*?text-base/);
    expect(card).toMatch(/data-slot="card-description"(?![\w-])[\s\S]*?text-sm/);
  });
});

describe("shadcn Select is deliberately unused", () => {
  it("exists but no app or component imports it", () => {
    // Recorded so the next person does not "fix" the dropdowns by swapping to
    // it: a custom listbox is better on desktop and worse on iOS/Android.
    expect(() =>
      readFileSync(join(ROOT, "components", "ui", "select.tsx"), "utf8"),
    ).not.toThrow();

    // Scan only app/ and components/ — this test file quotes the import path,
    // and matching a string that appears in its own assertion would be the
    // auditor-equivalent of grading your own homework.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (["node_modules", ".next", ".git"].includes(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (
          /\.tsx?$/.test(entry) &&
          readFileSync(full, "utf8").includes("@/components/ui/select")
        ) {
          offenders.push(full);
        }
      }
    };
    for (const dir of ["app", "components"]) walk(join(ROOT, dir));

    expect(offenders).toEqual([]);
  });
});