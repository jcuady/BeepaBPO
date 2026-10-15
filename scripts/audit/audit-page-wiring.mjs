/**
 * Page-wiring scan.
 *
 * Finds interactive controls that look real but cannot do anything: buttons
 * with no handler and no navigation; permanently-disabled controls; forms that
 * can never submit; placeholder copy that shipped; and links to routes that do
 * not exist.
 *
 * Operates on whole JSX tags rather than single lines, because handlers and
 * props routinely sit on their own lines and a line-based pass reports every
 * multi-line button as dead. A scanner that cries wolf gets ignored, so the
 * bar here is "only report something when the whole tag genuinely has no way to
 * act".
 *
 * This is a static heuristic, not a behavioural test. It reports candidates for
 * human confirmation and names file:line for each. It never asserts a control
 * is broken.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const SKIP = new Set(["node_modules", ".next", ".git", ".auth", "coverage"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/** Extract every `<name ...>` opening tag, spanning lines, with its line number. */
function tags(src, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b`, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    let quote = null;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
      } else if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === "<") depth += 1;
      else if (c === ">" && depth === 1) break;
      i += 1;
    }
    const body = src.slice(m.index, Math.min(i + 1, src.length));
    out.push({
      text: body,
      line: src.slice(0, m.index).split(/\r?\n/).length,
    });
    re.lastIndex = i;
  }
  return out;
}

/** True if the tag carries a JSX expression attribute such as {...} or foo={...}. */
const hasDynamicAttr = (tag) => /=\s*\{/.test(tag);

const HANDLER = /\bon[A-Z][A-Za-z]*\s*=\s*\{/;
const NAV_ATTR = /\b(href|formAction|action|type)\s*=\s*\{?"/;

const findings = {
  deadButtons: [],
  permanentDisabled: [],
  unsendableForms: [],
  hrefToNowhere: [],
  placeholderCopy: [],
};

/**
 * Blank out comments, preserving length and line breaks.
 *
 * WHY
 * ---
 * The scanner reads raw source, so prose about a control counts as the control.
 * It reported two "buttons with no handler" that are not buttons at all:
 *
 *   confirm-dialog.tsx:84      "...clicking a <button> does NOT focus it."
 *   landing-primitives.tsx:307 "The product Button renders a Base UI <button>..."
 *
 * Both lines are inside JSDoc comments explaining why the code is written the way
 * it is. A gate whose only findings are its own comments is worse than no gate:
 * it trains a reader to skim past it, and it fails its own stated bar — "a
 * scanner that cries wolf gets ignored".
 *
 * Replacement, not deletion: the output has the same length and the same number
 * of lines, so every `file:line` this script reports still points where it did.
 *
 * STRING SAFETY: a naive `.replace(/\/\/.*$/gm)` would eat `https://…` inside a
 * string and, worse, silently change the length so every subsequent line number
 * shifts. So this is a small state machine that knows it is inside a string.
 * A template literal's `${…}` re-enters code mode, which keeps nested JSX in
 * `${`"${…}`"}` visible to the scanner — the alternative would hide real markup.
 */
function stripComments(src) {
  let out = "";
  let mode = "code"; // code | line | block | sq | dq | tpl
  let tplDepth = 0; // nesting of ${ } inside a template literal

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (mode === "code") {
      if (c === "/" && next === "/") { mode = "line"; out += "  "; i++; continue; }
      if (c === "/" && next === "*") { mode = "block"; out += "  "; i++; continue; }
      if (c === "'") { mode = "sq"; out += c; continue; }
      if (c === '"') { mode = "dq"; out += c; continue; }
      if (c === "`") { mode = "tpl"; tplDepth = 0; out += c; continue; }
      out += c;
      continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; } else out += " ";
      continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") { mode = "code"; out += "  "; i++; continue; }
      out += c === "\n" ? "\n" : " ";
      continue;
    }
    // Inside a quoted string: only the closing quote matters. A `//` here is data
    // (a URL), not a comment, and must be left alone.
    if (mode === "sq") { out += c; if (c === "\\") { out += src[++i] ?? ""; } else if (c === "'") mode = "code"; continue; }
    if (mode === "dq") { out += c; if (c === "\\") { out += src[++i] ?? ""; } else if (c === '"') mode = "code"; continue; }
    if (mode === "tpl") {
      if (c === "\\") { out += c + (src[i + 1] ?? ""); i++; continue; }
      if (c === "$" && next === "{") { mode = "code"; tplDepth = 1; out += "${"; i++; continue; }
      if (c === "`") { mode = "code"; out += c; continue; }
      out += c;
      continue;
    }
    // Back in code, having left a ${ }. Close the template when its brace depth
    // returns to zero.
    if (c === "{") tplDepth++;
    else if (c === "}") {
      tplDepth--;
      if (tplDepth === 0) mode = "tpl";
    }
    out += c;
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  // `src` is raw: the placeholder-copy scan below deliberately reads comments,
  // because "TODO"/"coming soon" often live in one.
  const src = readFileSync(file, "utf8");
  // `code` is comment-free: every STRUCTURAL scan below reads this, so a sentence
  // describing a <button> is never mistaken for one.
  const code = stripComments(src);

  // ---- Buttons that cannot act -------------------------------------------
  for (const tag of tags(code, "button")) {
    const { text, line } = tag;
    if (HANDLER.test(text)) continue; // onClick / onMouseDown / …
    if (NAV_ATTR.test(text)) continue; // type="submit" / type="button" is explicit
    if (hasDynamicAttr(text)) continue; // spreads, disabled={pending}, onClick={x} passed in
    if (/\{children\}/.test(text) && !/>\s*$/.test(text)) continue;
    findings.deadButtons.push(
      `${rel}:${line}  ${text.replace(/\s+/g, " ").slice(0, 100)}`,
    );
  }

  // ---- Controls disabled with no dynamic condition ------------------------
  for (const tag of tags(src, "Button")) {
    const { text, line } = tag;
    const d = /\bdisabled\b\s*(=|\s|>)/.exec(text);
    if (!d) continue;
    const after = text.slice(d.index + d[0].length, d.index + d[0].length + 2);
    // disabled={expr} and disabled={a && b} are conditional; only bare
    // `disabled` or disabled="..." with a literal true is permanent.
    if (after.startsWith("=") && /^\s*=\s*\{/.test(text.slice(d.index))) continue;
    if (/disabled\s*=\s*\{/.test(text)) continue;
    if (!/\bdisabled(\s|>|=)/.test(text)) continue;
    findings.permanentDisabled.push(
      `${rel}:${line}  ${text.replace(/\s+/g, " ").slice(0, 100)}`,
    );
  }

  // ---- Forms that can never submit ---------------------------------------
  for (const tag of tags(code, "form")) {
    const { text, line } = tag;
    if (/\bmethod\s*=/.test(text)) continue; // native GET/POST filter form
    if (/\baction\s*=/.test(text)) continue;
    if (HANDLER.test(text)) continue; // onSubmit
    findings.unsendableForms.push(
      `${rel}:${line}  ${text.replace(/\s+/g, " ").slice(0, 100)}`,
    );
  }

  // ---- Links to routes with no page --------------------------------------
  for (const m of code.matchAll(/href\s*=\s*["'`]\/app\/([^"'`?#]*)/g)) {
    const target = "/app/" + m[1].replace(/\/$/, "");
    if (!target || target.includes("${") || target.includes("{")) continue;
    if (!existsSync(join(ROOT, "app", target.replace(/^\//, ""), "page.tsx"))) {
      findings.hrefToNowhere.push(
        `${rel}:${code.slice(0, m.index).split(/\r?\n/).length}  -> ${target}`,
      );
    }
  }

  // ---- Placeholder copy --------------------------------------------------
  for (const [i, lineText] of src.split(/\r?\n/).entries()) {
    if (
      /\b(coming soon|TODO|lorem ipsum|implement me|not implemented|under construction|placeholder text)\b/i.test(
        lineText,
      )
    ) {
      findings.placeholderCopy.push(`${rel}:${i + 1}  ${lineText.trim().slice(0, 100)}`);
    }
  }
}

const sections = [
  ["Buttons with no handler, type, href, or dynamic prop", findings.deadButtons],
  ["Controls with permanently disabled state", findings.permanentDisabled],
  ["Forms that can never submit", findings.unsendableForms],
  ["Links to /app routes with no page.tsx", findings.hrefToNowhere],
  ["Placeholder copy", findings.placeholderCopy],
];

const total = sections.reduce((n, [, l]) => n + l.length, 0);

console.log(`Scanned ${files.length} .tsx file(s) under ${SCAN_DIRS.join(", ")}.\n`);
for (const [title, list] of sections) {
  console.log(`${title}: ${list.length}`);
  for (const item of list.slice(0, 20)) console.log(`    ${item}`);
  if (list.length > 20) console.log(`    ... and ${list.length - 20} more`);
  console.log("");
}

console.log(`Total candidates: ${total}`);
console.log(
  total === 0
    ? "VERDICT: no unwired controls detected by static analysis."
    : "VERDICT: candidates above need human confirmation. Static analysis cannot prove a control is dead.",
);