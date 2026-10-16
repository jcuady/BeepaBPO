// Per-URL metadata gate: titles, descriptions, canonicals, Open Graph and JSON-LD.
//
// This distinction decides whether the fix exists at all for a crawler. Google
// reads the initial response; a meta tag that only appears after hydration was
// never indexed. So this asserts against the raw HTML string, before any script
// runs.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const EVIDENCE = "docs/evidence/seo-metadata.json";

// `QA_BASE_URL` first, positional second. It read only `argv[2]`, so it was the
// one HTTP audit in `scripts/audit/` that could not be pointed at a deployed
// preview by the documented convention — the operator sets `QA_BASE_URL`, this
// script measures localhost anyway, and reports a clean run for a host nobody
// crawled. Same defect `audit-suite-base-url` exists to catch, in the one script
// that gate did not flag because it declares no env override at all.
const ORIGIN = (process.env.QA_BASE_URL ?? process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");

/**
 * Write this gate's verdict to disk.
 *
 * WHY
 * ---
 * A metadata audit whose result lived in terminal scrollback could not be
 * re-read, dated, or compared to a later run — and its whole subject (titles,
 * descriptions) is precisely the kind of content that changes silently when
 * someone edits a page. The per-URL numbers are what makes a regression visible:
 * "description 47 chars" six months after the fact is answerable only from a
 * file.
 *
 * `urlsChecked` is the denominator. "ALL CHECKS PASS" over a sitemap that
 * resolved to zero URLs is the same string as a pass over twenty, and that is
 * exactly the outage this gate would fail to notice.
 */
function writeEvidence(exitCode, verdict, verdictText, data = {}) {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        check: "seo-metadata",
        generatedAt: new Date().toISOString(),
        origin: ORIGIN,
        verdict,
        verdictText,
        urlsChecked: 0,
        failureCount: 0,
        urls: [],
        failures: [],
        ...data,
        exitCode,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`wrote ${EVIDENCE}`);
}

const get = (path) => execFileSync("curl", ["-sS", "-L", "--max-time=25", `${ORIGIN}${path}`], {
  encoding: "utf8", maxBuffer: 1 << 28,
});

let sm;
try {
  sm = get("/sitemap.xml");
} catch (err) {
  // A sitemap that cannot be fetched is not an empty list of URLs to check. It
  // used to throw an unhandled ENOENT/curl error, which exits non-zero but writes
  // nothing — so the runner saw a failure with no evidence to read it from.
  console.error(`ABORT: could not fetch ${ORIGIN}/sitemap.xml — ${err.message}`);
  writeEvidence(2, "unknown", `CANNOT TELL — could not fetch the sitemap from ${ORIGIN}`);
  process.exit(2);
}
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (!urls.length) {
  // Zero URLs would otherwise report "ALL CHECKS PASS" — a green run that
  // checked nothing, which is the failure mode this gate is supposed to prevent.
  console.error("ABORT: the sitemap contains no <loc> entries, so no page was checked.");
  writeEvidence(2, "unknown", "CANNOT TELL — the sitemap contains no <loc> entries");
  process.exit(2);
}

let failures = 0;
const failureList = [];
const urlResults = [];
const fail = (path, msg) => {
  failures++;
  failureList.push({ path, problem: msg });
  console.log(`  FAIL [${path}] ${msg}`);
};

for (const u of urls) {
  const path = u.includes("localhost") ? u.replace(ORIGIN, "") : u.replace("https://beepabpo.com", "");
  const html = get(path);

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  const canonical = [...html.matchAll(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/g)].map((m) => m[1]);
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  const twCard = html.match(/<meta[^>]+name="twitter:card"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  const ldTypes = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1])["@type"] ?? "graph"; } catch { return "INVALID"; } });

  const isEditorial = path.includes("/resources/") || path.includes("/case-studies/");

  if (!title) fail(path, "no <title>");
  else if (title.length > 60) fail(path, `title ${title.length} chars: "${title}"`);
  if (!desc) fail(path, "no meta description");
  else if (desc.length > 160) fail(path, `description ${desc.length} chars`);
  else if (desc.length < 60) {
    // Floor of 60, not 70. Google's guidance is a ~155-character MAXIMUM; a
    // 65-character description renders in full and reads fine. The page that
    // actually failed this check was 37 characters ("Outcomes from teams built
    // with Beepa."), which reads as a stub next to every competitor. Padding a
    // 68-character CMS description to hit an arbitrary line would be writing
    // filler to satisfy a metric, not improving the page.
    fail(path, `description ${desc.length} chars (<60)`);
  }
  if (canonical.length !== 1) fail(path, `${canonical.length} canonical tags`);
  if (!ogImage) fail(path, "no og:image");
  if (!ogUrl) fail(path, "no og:url");
  if (!ogTitle) fail(path, "no og:title");
  if (!twCard) fail(path, "no twitter:card");
  if (ldTypes.includes("INVALID")) fail(path, "JSON-LD is not valid JSON");
  if (ldTypes.length === 0) fail(path, "no JSON-LD");
  if (isEditorial && !ldTypes.includes("Article")) fail(path, `editorial page without Article JSON-LD (has ${ldTypes.join(",")})`);

  console.log(
    `${path.padEnd(38)} t=${String(title.length).padStart(3)} d=${String(desc.length).padStart(3)} og=${ogImage ? "y" : "n"} url=${ogUrl ? "y" : "n"} ld=[${ldTypes.join(",")}]`,
  );

  // The measured numbers, not just the pass/fail. A title that is 3 characters
  // from the limit today and 61 tomorrow is a different finding from one that
  // has been at 12 all along, and only the number distinguishes them later.
  urlResults.push({
    path,
    titleLength: title.length,
    descriptionLength: desc.length,
    canonicalCount: canonical.length,
    hasOgImage: Boolean(ogImage),
    hasOgUrl: Boolean(ogUrl),
    hasOgTitle: Boolean(ogTitle),
    hasTwitterCard: Boolean(twCard),
    jsonLdTypes: ldTypes,
  });
}

console.log(failures ? `\n${failures} issue(s) remain` : "\nALL CHECKS PASS");
writeEvidence(
  failures ? 1 : 0,
  failures ? "issues" : "clean",
  failures ? `${failures} metadata issue(s) remain` : `all ${urls.length} sitemap URL(s) carry complete metadata`,
  { urlsChecked: urls.length, failureCount: failures, urls: urlResults, failures: failureList },
);
process.exit(failures ? 1 : 0);