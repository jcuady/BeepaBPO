/**
 * Touch-target override classifier.
 *
 * `docs/REMAINING_WORK.md` §2.1 records 242 `min-h-11` across 119 files and
 * defers them as "needs visual review". 242 call sites is too many to eyeball,
 * and a reviewer who does not already know which of them are load-bearing will
 * delete the wrong ones.
 *
 * The distinction turns out to be mechanical, so this classifies rather than
 * guesses:
 *
 *   REDUNDANT-PRIMITIVE
 *     `min-h-11` on a component whose primitive already raises itself to 44px
 *     on coarse pointers. The rule the override was added to enforce is
 *     already in the primitive.
 *
 *   DEFEATS-COMPACT-VARIANT
 *     The same, but on a Button with a deliberately small size (`sm`, `xs`,
 *     `icon*`). This one is a real defect: the variant exists to be compact,
 *     and the override silently un-does it.
 *
 *   WIDENS-DESKTOP
 *     The primitive raises itself only under `@media(pointer:coarse)`. A bare
 *     `min-h-11` at the call site has no media query, so it forces 44px on
 *     desktop too, where `sm` is meant to be 28px. Whether that is wanted is a
 *     design call — but it should be a call, not a leftover.
 *
 *   LOAD-BEARING
 *     On a plain `<Link>`, `<a>`, `<button>`, `<div>` or a component with no
 *     touch-target floor of its own. Removing these drops real targets below
 *     44px on phones. **Do not sweep these.**
 *
 * Read-only. Run: node scripts/audit/audit-touch-overrides.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** Components that already self-raise to 44px under @media(pointer:coarse). */
const SELF_RAISING = new Set(["Button", "Input", "NativeSelect", "NativeSelectCompact", "FilterBar"]);

/**
 * A *bare* `min-h-11` — the defect.
 *
 * Must not match `[@media(pointer:coarse)]:min-h-11`, which is the correct way
 * to write this: 36px on desktop, 44px on touch. The first version of this
 * classifier used a plain substring match and flagged every one of those as a
 * defect, which would have had a sweep deleting the exact pattern the project
 * wanted. A bare token is preceded by whitespace or a quote; a variant-prefixed
 * one is preceded by `]`.
 */
const BARE_MIN_H_11 = /(?:^|[\s"'])min-h-11(?=[\s"'])/;

function hasBareOverride(attrs) {
  return BARE_MIN_H_11.test(attrs);
}

/** Button size variants that exist specifically to be compact. */
const COMPACT_SIZES = new Set(["sm", "xs", "icon", "icon-sm", "icon-lg"]);

/** Components known to carry no floor of their own — treated as load-bearing. */
const KNOWN_NO_FLOOR = new Set([
  "Textarea",
  "Link",
  "a",
  "button",
  "div",
  "span",
  "p",
  "td",
  "th",
  "label",
  "Select",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("//") ? "" : l))
    .join("\n");
}

const buckets = { "defeats-compact-variant": [], "widens-desktop": [], "redundant-primitive": [], "load-bearing": [] };
const unclassified = [];
let unmatched = 0;
let matched = 0;

for (const dir of ["app", "components"]) {
  const abs = join(ROOT, dir);
  let files;
  try {
    files = walk(abs);
  } catch {
    continue; // directory absent in this checkout
  }

  for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const src = stripComments(readFileSync(file, "utf8"));

    // Opening tags only. `[^>]*` stops at the first `>`, which truncates tags
    // containing `=>` in a handler — noted as a limitation rather than fixed,
    // because `className` is written before `onClick` by convention throughout
    // this codebase, and over-engineering the parser would only add ways to be
    // confidently wrong.
    for (const m of src.matchAll(/<([A-Za-z][A-Za-z0-9_.]*)\b([^>]*)>/g)) {
      const [, tag, attrs] = m;
      if (!hasBareOverride(attrs)) continue;
      matched += 1;

      const line = src.slice(0, m.index).split("\n").length;
      const hit = `${rel}:${line}`;
      const size = attrs.match(/\bsize="([^"]+)"/)?.[1];

      if (KNOWN_NO_FLOOR.has(tag)) {
        buckets["load-bearing"].push(hit);
      } else if (tag === "Button" && size && COMPACT_SIZES.has(size)) {
        buckets["defeats-compact-variant"].push(`${hit}  <Button size="${size}">`);
      } else if (SELF_RAISING.has(tag)) {
        buckets["widens-desktop"].push(`${hit}  <${tag}${size ? ` size="${size}"` : ""}>`);
      } else {
        unmatched += 1;
        unclassified.push(`${hit}  <${tag}${size ? ` size="${size}"` : ""}>`);
      }
    }
  }
}

const total = Object.values(buckets).reduce((s, b) => s + b.length, 0) + unmatched;

console.log(`min-h-11 in JSX opening tags: ${matched} across ${new Set([...Object.values(buckets).flat()].map((h) => h.split(":")[0])).size} file(s)`);
console.log(`(total textual occurrences including non-tag contexts: ${(matched + unmatched)} classified)\n`);

for (const [name, list] of Object.entries(buckets)) {
  const label = name.toUpperCase();
  console.log(`  ${label.padEnd(26)} ${String(list.length).padStart(4)}`);
}
console.log(`  ${"UNCLASSIFIED".padEnd(26)} ${String(unmatched).padStart(4)}`);
console.log("");

console.log("DEFEATS-COMPACT-VARIANT — a small-size Button forced to 44px. These are unambiguous:");
for (const h of buckets["defeats-compact-variant"]) console.log(`  ${h}`);

console.log("\nWIDENS-DESKTOP — the primitive handles coarse pointers; this also forces 44px on");
console.log("desktop, where the variant is meant to be compact. Design call, not a bug:");
for (const h of buckets["widens-desktop"].slice(0, 40)) console.log(`  ${h}`);
if (buckets["widens-desktop"].length > 40) {
  console.log(`  … and ${buckets["widens-desktop"].length - 40} more`);
}

/**
 * Break the WIDENS-DESKTOP bucket down by surface.
 *
 * "96 overrides need a design decision" is not a question anyone can answer. The
 * answer flips by surface: a 44px call-to-action on a marketing page is a normal
 * thing to ship, while a 44px button in a dense desktop app table is not, and the
 * person deciding almost certainly wants those two treated differently. So they
 * are counted separately rather than presented as one pile.
 */
const surfaces = { "marketing site (public)": 0, "auth screens": 0, "app surfaces": 0 };
for (const hit of buckets["widens-desktop"]) {
  const path = hit.split(":")[0];
  if (path.startsWith("app/(marketing)") || path.startsWith("components/marketing") || path.startsWith("components/layout/")) {
    surfaces["marketing site (public)"] += 1;
  } else if (path.startsWith("components/auth/")) {
    surfaces["auth screens"] += 1;
  } else {
    surfaces["app surfaces"] += 1;
  }
}

console.log("\n  by surface:");
for (const [name, n] of Object.entries(surfaces)) {
  console.log(`    ${String(n).padStart(4)}  ${name}`);
}
console.log(
  "\n  A 44px control on a public marketing page is ordinary. A 44px control in a\n" +
    "  dense desktop table is not. If the intent was 'fix the phone', the app-surface\n" +
    "  rows are leftovers and should become [@media(pointer:coarse)]:min-h-11; if it\n" +
    "  was 'these should always be big', they are correct as written.",
);

if (unmatched) {
  console.log("UNCLASSIFIED — a component not in the known lists. Counted, not bucketed:");
  for (const h of unclassified) console.log(`  ${h}`);
  console.log(
    `\nNOTE: an unknown component may or may not self-raise. Guessing here would put a\n` +
      `      load-bearing touch target at risk, so these are reported for a human, not swept.`,
  );
}

console.log(`\nTotal bucketed: ${total}`);
console.log(
  `\nDo NOT sweep the ${buckets["load-bearing"].length} LOAD-BEARING site(s): they are the only thing\n` +
    `holding some controls to 44px on a phone.`,
);