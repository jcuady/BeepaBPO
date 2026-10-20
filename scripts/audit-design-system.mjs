#!/usr/bin/env node
/**
 * Design-system consistency audit.
 *
 * Measures whether the app actually uses one design system, or thirty
 * hand-rolled approximations of it. Written because the first pass found 26
 * dropdowns across 22 files that had each drifted to a different radius and
 * background — and **none of which had a focus ring**, because they were raw
 * `<select>` elements rather than the primitive.
 *
 * What fails the gate (exit 1):
 *   1. A raw HTML element used where a shadcn primitive already exists.
 *   2. A hardcoded colour literal outside `app/globals.css`.
 *
 * What is reported but does not fail (exit 0):
 *   3. Arbitrary `rounded-[Npx]` values that bypass the radius scale.
 *
 * Item 3 is informational on purpose. The radius scale is
 * `--radius-sm:8 --radius-md:12 --radius-lg:16 --radius-xl:24`, and the codebase
 * grew a dozen arbitrary values before this script existed. Failing the gate on
 * all of them at once would mean a sweep with no way to review the visual
 * result; the count is a progress metric until that sweep lands.
 *
 * It is counted over EVERY scanned file, including the primitives. The
 * primitive and colour checks exclude `components/ui/` because a primitive's
 * own markup would be a false positive there; a radius class is not. The last
 * three arbitrary values live in `components/ui/chart.tsx` and
 * `components/ui/tooltip.tsx`, so excluding the primitives made this metric
 * report `0` while the design system document published `106 uses, 8
 * off-scale`. It now reports what is actually there, and names the files.
 *
 * Each check strips comments first — otherwise this file's own documentation of
 * the violations would count them.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN = ["app", "components"];

/** Elements that must come from `components/ui/`, not be hand-rolled. */
const MUST_USE_PRIMITIVE = [
  { tag: "select", primitive: "components/ui/native-select.tsx" },
  { tag: "table", primitive: "components/ui/table.tsx" },
  // Added 2026-10-09. The gate previously covered only <select> and <table>,
  // so "0 raw primitives" meant "no raw selects or tables" — a much narrower
  // claim than the verdict line implied, and one that left every hand-rolled
  // <input>, <textarea> and <button> invisible. The first instance found was a
  // date picker on /app/attendance carrying `rounded-[12px]`, sitting inside the
  // same FilterBar as a correct NativeSelect: the two controls could not match.
  { tag: "input", primitive: "components/ui/input.tsx" },
  { tag: "textarea", primitive: "components/ui/textarea.tsx" },
  { tag: "button", primitive: "components/ui/button.tsx" },
];

/**
 * Input types the `Input` primitive does not stand in for.
 *
 * A checkbox, radio, file picker, range or colour swatch is a different control
 * category: it has no text field to style, and running `Input`'s `h-8 rounded-lg
 * px-2.5` over one would break it. A hidden input renders nothing at all.
 *
 * The first run of the widened rule reported three of these as violations —
 * a `type="radio"` in the payroll wizard and two `type="checkbox"`s — which are
 * correct code. A gate that flags correct code gets switched off, so they are
 * exempted by type rather than "fixed" into something worse.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  "hidden",
  "checkbox",
  "radio",
  "file",
  "range",
  "color",
  "image",
]);

/**
 * Raw `<button>` elements that are correct code, with the reason.
 *
 * Each of these is a control that is *deliberately* not a Button variant:
 * a full-width list row, a heatmap cell, a search-bar lookalike. Wrapping them
 * in `<Button>` would give them padding, a border radius and a focus ring that
 * their layout does not want. Flagging them would be flagging correct code,
 * which is how a gate gets switched off and then believed when it is wrong.
 *
 * Keyed by file path and matched per occurrence, so a *different* raw button
 * added to the same file later is still reported.
 */
const RAW_BUTTON_ALLOWLIST = new Map([
  [
    "components/app/notification-bell.tsx",
    "full-width notification list row inside the popover — a Button would add px/py and a border radius the row does not want",
  ],
  [
    "components/app/notifications-page-client.tsx",
    "notification list rows (2) — same full-width row pattern, not a Button variant",
  ],
  [
    "components/app/attendance/attendance-heatmap.tsx",
    "heatmap cells and a text-link-styled button — the cell colour comes from KIND_CLASS, not a Button variant",
  ],
  [
    "components/app/app-header.tsx",
    "the ⌘K search bar is styled as a text field, not as a button",
  ],
]);

function isAllowlisted(rel, tag) {
  return tag === "button" && RAW_BUTTON_ALLOWLIST.has(rel);
}

function isExempt(src, tag, openingTag) {
  if (tag !== "input") return false;
  // No type attribute at all defaults to text, which the primitive does replace.
  const type = openingTag.match(/type\s*=\s*["']([^"']+)["']/)?.[1];
  return type !== undefined && NON_TEXT_INPUT_TYPES.has(type.toLowerCase());
}

/**
 * Files where a colour literal is not design-system drift.
 *
 * Both of these are *serialized output*, not CSS: the PWA manifest and the
 * viewport `<meta>` are emitted as JSON/HTML attributes and never see the
 * stylesheet, so there is no token available to reference. Flagging them would
 * be a false positive that trains people to ignore this script.
 */
const COLOUR_ALLOWLIST = new Map([
  ["app/manifest.ts", "PWA manifest JSON — serialized, cannot read CSS tokens"],
  ["app/layout.tsx", "viewport themeColor meta — serialized, cannot read CSS tokens"],
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "docs"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Remove line and block comments so documentation is not counted as code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("//");
    })
    .join("\n");
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d)));
// Normalise separators before comparing paths — on Windows `relative()` returns
// backslashes, so a plain `startsWith("components/ui")` silently matched
// nothing and the script audited its own primitives. That is exactly how an
// auditor ends up reporting nonsense and getting switched off.
const relOf = (f) => relative(ROOT, f).split("\\").join("/");
const primitiveFiles = new Set(
  files.filter((f) => relOf(f).startsWith("components/ui/")),
);
const targets = files.filter((f) => !primitiveFiles.has(f));

const rawElements = [];
const hexColors = [];
const allowlisted = [];
const primitiveAllowlisted = [];

for (const file of targets) {
  const rel = relOf(file);
  const src = stripComments(readFileSync(file, "utf8"));

  for (const { tag, primitive } of MUST_USE_PRIMITIVE) {
    let n = 0;
    for (const m of src.matchAll(new RegExp(`<${tag}([\\s>][\\s\\S]*?)?>`, "g"))) {
      if (isExempt(src, tag, m[0])) continue;
      n += 1;
    }
    if (n && !isAllowlisted(rel, tag)) rawElements.push({ rel, tag, n, primitive });
    else if (n) {
      // Separate list from the colour allowlist. Sharing one array made these
      // four button exemptions print under "HARDCODED COLOURS", which is both
      // wrong and the sort of thing that makes someone stop reading the output.
      primitiveAllowlisted.push({ rel, tag, n, reason: RAW_BUTTON_ALLOWLIST.get(rel) });
    }
  }

  // Colour literals. `globals.css` is the only file allowed to define them.
  const colors = src.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\brgba?\(/g);
  if (colors) {
    const reason = COLOUR_ALLOWLIST.get(rel);
    if (reason) allowlisted.push({ rel, n: colors.length, reason });
    else hexColors.push({ rel, n: colors.length });
  }

}

/**
 * The radius scale is counted over EVERY scanned file, including the
 * primitives.
 *
 * WHY IT IS NOT `targets`: the exclusion above exists for the primitive and
 * colour checks, where a primitive's own markup would be a false positive.
 * A radius class is not that. `components/ui/chart.tsx` and
 * `components/ui/tooltip.tsx` are where the last three arbitrary values live,
 * so excluding the primitives made this metric blind to precisely the values
 * that remained — and it reported `0` while the design system document
 * published `106 uses, 8 off-scale`. A metric that cannot see the thing it
 * measures is not a metric.
 *
 * The file list is reported alongside each value, so a reader can see WHERE
 * the remaining values are instead of being asked to trust a count.
 */
const radiusSites = new Map();
for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  for (const m of src.matchAll(/rounded-\[(\d+)px\]/g)) {
    const value = m[1];
    if (!radiusSites.has(value)) radiusSites.set(value, { count: 0, files: new Set() });
    const entry = radiusSites.get(value);
    entry.count += 1;
    entry.files.add(relOf(file));
  }
}

console.log("DESIGN SYSTEM AUDIT");
console.log("─".repeat(60));
console.log(`Scanned ${targets.length} source file(s) under ${SCAN.join(", ")}`);
console.log("");

// 1. Raw primitives
if (rawElements.length) {
  console.log(`RAW PRIMITIVE USAGE — ${rawElements.length} file(s)`);
  for (const r of rawElements) {
    console.log(
      `  ${r.rel}  ${r.n}x <${r.tag}>  →  use ${r.primitive}`,
    );
  }
} else {
  console.log("RAW PRIMITIVE USAGE   0   every control comes from components/ui/");
}
console.log("");

// 1b. Raw primitives deliberately exempted — printed so the exemption list is
// visible in CI output rather than living only in the source.
if (primitiveAllowlisted.length) {
  console.log(`RAW PRIMITIVES ALLOWED (${primitiveAllowlisted.length} file(s)) — deliberate:`);
  for (const a of primitiveAllowlisted) {
    console.log(`  ${a.rel}  ${a.n}x <${a.tag}>  — ${a.reason}`);
  }
  console.log("");
}

// 2. Hardcoded colours
if (hexColors.length) {
  console.log(`HARDCODED COLOURS — ${hexColors.length} file(s)`);
  for (const c of hexColors) {
    console.log(`  ${c.rel}  ${c.n} literal(s)  →  use a design token`);
  }
} else {
  console.log("HARDCODED COLOURS     0   colours come from the token layer");
}
if (allowlisted.length) {
  console.log(`  allowed (${allowlisted.length}):`);
  for (const a of allowlisted) {
    console.log(`    ${a.rel}  ${a.n} literal(s) — ${a.reason}`);
  }
}
console.log("");

// 3. Radius scale (informational)
const radiusTotal = [...radiusSites.values()].reduce((a, e) => a + e.count, 0);
console.log(
  `ARBITRARY RADIUS      ${radiusSites.size} distinct value(s), ${radiusTotal} use(s)  [informational]`,
);
if (radiusSites.size) {
  const scale = new Set(["8", "12", "16", "24"]);
  const offScale = [...radiusSites.entries()].filter(([v]) => !scale.has(v));
  const sorted = [...radiusSites.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [value, entry] of sorted) {
    const mark = scale.has(value) ? "  (on scale)" : "  ← off scale";
    console.log(
      `  rounded-[${value}px] x${entry.count}${mark}  ${[...entry.files].join(", ")}`,
    );
  }
  console.log(
    `  Scale is --radius-sm:8 --radius-md:12 --radius-lg:16 --radius-xl:24. ` +
      `${offScale.length} value(s) bypass it.`,
  );
}
console.log("");

const failures = rawElements.length + hexColors.length;
if (failures) {
  console.log(
    `VERDICT: ${failures} finding(s). Raw elements and hardcoded colours bypass the design system.`,
  );
  process.exit(1);
}
console.log("VERDICT: no raw primitives and no hardcoded colours.");
if (radiusSites.size) {
  console.log(
    `  ${radiusSites.size} arbitrary radius value(s) remain — informational until the sweep lands.`,
  );
}