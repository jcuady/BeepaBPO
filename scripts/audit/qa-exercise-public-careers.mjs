// The public careers list must actually filter.
//
// Why this is a gate
// ------------------
// `/careers` grew a search box and three filters. Filters that render are not
// filters that work: a `<select>` can post a value the query ignores, a `q`
// parameter can be accepted and then never matched, and a "no results" state can
// quietly show the unfiltered list. Every one of those renders perfectly.
//
// So this asserts against the RENDERED HTML over HTTP rather than in a browser.
// That is the stricter instrument for this particular claim: what is being
// tested is the server's output, which is exactly what a crawler receives and
// exactly what a shared link resolves to. A browser adds a rendering layer that
// cannot change which rows the server emitted.
//
// Two failures shaped this file and are worth not repeating:
//
//  1. The first parser assumed `<a href=...>` opened the tag. React emits
//     `class` first, so the regex matched NOTHING on every URL and reported all
//     eight cases as failures against a page that works. It now asserts that it
//     found the expected rows on `/careers` before trusting any result — an
//     empty corpus and a real negative are indistinguishable otherwise.
//  2. An unknown filter value must be IGNORED, not honoured. `?setup=nonsense`
//     that fell through to "no filter" would show all five roles and read as
//     though the filter worked. It is asserted explicitly.
//
// Requires a running server. Fails (exit 1) on any broken assertion, and
// BLOCKED-style (exit 2) if the server is not there at all — a missing server
// is not a careers defect.

import { writeEvidence } from "./lib/evidence.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const results = [];
const notes = [];

function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

/**
 * Role rows, parsed one `<li>` at a time. Splitting on the list item means a
 * match cannot span two rows, and it does not care what attribute order React
 * happened to emit.
 */
function roles(html) {
  const out = [];
  for (const chunk of html.split("<li>")) {
    const m =
      /<a\b[^>]*href="\/careers\/([a-z0-9-]+)"[\s\S]*?<p class="[^"]*font-display[^"]*">([^<]+)<\/p>/.exec(
        chunk,
      );
    if (m) out.push({ slug: m[1], title: m[2].trim() });
  }
  return out;
}

/**
 * Strip markup, React's `<!-- -->` text separators, and collapse the resulting
 * whitespace runs.
 *
 * All three are needed. React renders `There <!-- -->are 5 open roles<!-- -->,`
 * for a single JSX sentence, so a naive strip leaves "There  are 5 open roles "
 * with a double space and any regex written against the source text fails on
 * correct output.
 */
const prose = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const countText = (html) =>
  /(\d+ of \d+ open roles?|\d+ open roles?)/.exec(prose(html))?.[1] ?? null;

const selectedIn = (html, id) => {
  const block = new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`).exec(html)?.[0] ?? "";
  const m =
    /<option[^>]*selected[^>]*value="([^"]*)"/.exec(block) ??
    /value="([^"]*)"[^>]*selected/.exec(block);
  return m ? m[1] : "";
};

let reachable = true;
try {
  const probe = await fetch(BASE, { method: "HEAD" });
  reachable = probe.ok || probe.status < 500;
} catch {
  reachable = false;
}

if (!reachable) {
  console.error(`ABORT: no server at ${BASE}. Start it before running this exercise.`);
  notes.push(`no server at ${BASE}`);
  check("a server is reachable", false, `no server at ${BASE}`);
  process.exitCode = 2;
} else {
  // The parser must see the page before any of its results mean anything.
  const baseline = await get("/careers");
  const base = roles(baseline.html);
  check(
    "the careers page renders role rows this check can parse",
    base.length > 0,
    `${base.length} row(s) found`,
  );

  if (base.length > 0) {
    notes.push(`${base.length} published role(s): ${base.map((r) => r.title).join(", ")}`);

    const CASES = [
      { path: "/careers", expect: base.length, note: "unfiltered" },
      { path: "/careers?setup=onsite", note: "work setup = on-site" },
      { path: "/careers?setup=hybrid", note: "work setup = hybrid" },
      { path: "/careers?type=regular", note: "employment = full-time" },
      { path: "/careers?type=intern", note: "employment = internship" },
      { path: "/careers?q=the", note: "keyword that matches nothing" },
      { path: "/careers?setup=teleportation", note: "unrecognised filter value" },
    ];

    for (const c of CASES) {
      const { status, html } = await get(c.path);
      const got = roles(html);
      if (c.expect !== undefined) {
        check(
          `${c.path} returns every role`,
          status === 200 && got.length === c.expect,
          `${status}, ${got.length}/${c.expect} rows, count text "${countText(html)}"`,
        );
      } else {
        // No fixed expectation: assert only that the page answered and that the
        // rows it shows are a genuine subset of what exists.
        const subset = got.every((g) => base.some((b) => b.slug === g.slug));
        check(
          `${c.path} answers 200 with a genuine subset`,
          status === 200 && subset,
          `${status}, ${got.length} row(s)`,
        );
      }
    }

    // A term taken from a real title must find that role.
    const sample = base[0];
    const term = sample.title.split(/\s+/)[0];
    const hit = await get(`/careers?q=${encodeURIComponent(term)}`);
    const hits = roles(hit.html);
    check(
      `searching the first word of a real title finds it ("${term}")`,
      hits.some((r) => r.slug === sample.slug),
      hits.map((r) => r.title).join("; ") || "no rows",
    );

    // The empty state must not claim there are no jobs when there are.
    const none = await get("/careers?q=zzzznojobmatchesthis");
    const noneHtml = none.html;
    check(
      "an empty result says 'no roles match', not 'nothing open'",
      noneHtml.includes("No roles match that search") &&
        !noneHtml.includes("Nothing open at the moment"),
    );
    check(
      "an empty result still tells the reader how many roles exist",
      /There (?:is 1 open role|are \d+ open roles)/.test(prose(noneHtml)),
      /There (?:is 1 open role|are \d+ open roles)/.exec(prose(noneHtml))?.[0] ?? "no count in copy",
    );

    // A junk value must not silently widen into "no filter".
    const junk = await get("/careers?setup=teleportation");
    check(
      "an unrecognised filter value is ignored rather than applied",
      roles(junk.html).length === base.length && selectedIn(junk.html, "careers-setup") === "",
      `${roles(junk.html).length}/${base.length} rows, control shows "${selectedIn(junk.html, "careers-setup")}"`,
    );

    // The search term must survive a round trip so editing the filter does not
    // wipe what was typed.
    const kept = await get(`/careers?q=${encodeURIComponent(term)}`);
    check(
      "the search term is preserved back into the input",
      new RegExp(`id="careers-q"[^>]*value="${term}|value="${term}[^>]*id="careers-q"`).test(
        kept.html,
      ),
    );

    // Every filtered variant canonicalises to the clean list, or the same page
    // fragments its ranking signal across unbounded URLs.
    const canon = await get("/careers?q=the&setup=onsite");
    check(
      "filtered variants canonicalise to /careers",
      /<link rel="canonical" href="[^"]*\/careers"/.test(canon.html),
      /<link rel="canonical" href="[^"]*"/.exec(canon.html)?.[0] ?? "no canonical",
    );

    // The applicant account path is the point of the page.
    //
    // Scoped to the careers CTA block, NOT to every signup/login link on the
    // page. The first version scanned the whole document and failed on the site
    // header's plain `/login` link — which correctly has no `next`, because a
    // visitor clicking "Sign in" in the nav is not mid-application. Asserting on
    // the whole page would have been a check that flags correct behaviour.
    const block = /Applying for more than one role\?([\s\S]*?)<\/section>/.exec(noneHtml)?.[1] ?? "";
    const ctaLinks = [...block.matchAll(/href="(\/(?:signup|login)[^"]*)"/g)].map((m) => m[1]);
    check(
      "the applicant CTAs carry a return path back to careers",
      ctaLinks.length >= 2 && ctaLinks.every((h) => h.includes("next=")),
      ctaLinks.join(", ") || "no signup/login link inside the careers CTA block",
    );

    // The hero CTA is a second entry point and must also return here.
    const heroSignup = /href="\/signup\?next=\/careers"/.test(noneHtml);
    check("the hero 'Create account' CTA returns to /careers", heroSignup);

    // The page must not advertise a filter it does not have.
    //
    // `job_posts.department_id` points at `departments`, which is NOT readable
    // by an anonymous visitor -- its RLS policy is `to authenticated` using
    // `is_internal_user() or employees.read`, and the migration labels it
    // "Departments / teams (internal HR)". A "Team" dropdown built on it would
    // have rendered a control with one "All teams" option and no explanation,
    // so no team filter exists.
    //
    // The copy said otherwise in three places -- the meta description, the
    // instruction line and the search placeholder all said "team" -- and every
    // other gate was green, because a page that promises a filter and does not
    // have one renders perfectly. It is a promise, and it is checkable.
    const promisesTeam = /filter[^.]{0,40}\bteam\b|\bteam\b[^.]{0,40}filter|keyword or team/i.test(
      prose(noneHtml),
    );
    check(
      "the page does not advertise a team filter it cannot offer",
      !promisesTeam,
      promisesTeam ? "copy names a team filter; no team filter exists" : "no team filter advertised",
    );
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} assertions passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}

// ONE evidence write, after EVERY exitCode assignment.
//
// This was two, and the first was in the abort branch. `writeEvidence` derives
// its verdict from the exit code, so a write that happens before the verdict is
// decided records whatever code it finds at that moment -- and a write above
// the last assignment reports a failed run as PASS. The abort branch now sets
// its code and records a failed check, and both branches fall through to this
// single write.
//
// `tests/workflow-evidence-ownership.test.ts` enforces the ordering, and it is
// the reason this is one call and not two.
try {
  const { file } = writeEvidence({
    id: "public-careers",
    script: "scripts/audit/qa-exercise-public-careers.mjs",
    claim: "the public careers list searches and filters, and says so honestly when nothing matches",
    base: BASE,
    checks: results,
    notes,
    exitCode: process.exitCode ?? 0,
  });
  console.log(`wrote ${file}`);
} catch (err) {
  console.error("could not write evidence:", err instanceof Error ? err.message : String(err));
}