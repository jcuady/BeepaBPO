const { existsSync } = require("fs");
const { join } = require("path");
const nav = require("fs").readFileSync("lib/app/navigation.ts", "utf8");
const hrefs = [...nav.matchAll(/href:\s*"(\/app[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(hrefs)].sort();
const missing = [];
for (const h of unique) {
  const rel = h.replace(/^\/app\/?/, "");
  const candidates = [
    join("app/app", rel, "page.tsx"),
    join("app/app", rel, "route.ts"),
  ];
  if (!candidates.some(existsSync)) missing.push(h);
}
console.log(JSON.stringify({ count: unique.length, missing }, null, 2));
