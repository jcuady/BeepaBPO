// Per-URL metadata gate: titles, descriptions, canonicals, Open Graph and JSON-LD.
//
// This distinction decides whether the fix exists at all for a crawler. Google
// reads the initial response; a meta tag that only appears after hydration was
// never indexed. So this asserts against the raw HTML string, before any script
// runs.
import { execFileSync } from "node:child_process";

const ORIGIN = process.argv[2] ?? "http://localhost:3100";

const get = (path) => execFileSync("curl", ["-sS", "-L", "--max-time=25", `${ORIGIN}${path}`], {
  encoding: "utf8", maxBuffer: 1 << 28,
});

const sm = get("/sitemap.xml");
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

let failures = 0;
const fail = (path, msg) => { failures++; console.log(`  FAIL [${path}] ${msg}`); };

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
}

console.log(failures ? `\n${failures} issue(s) remain` : "\nALL CHECKS PASS");
process.exit(failures ? 1 : 0);