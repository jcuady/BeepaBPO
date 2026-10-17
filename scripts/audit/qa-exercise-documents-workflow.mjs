// Exercise the documents module: employee upload, client upload, and a signed
// download URL that actually returns the bytes that were uploaded.
//
// WHY: three actions in lib/documents/actions.ts, never driven through a browser.
// This is the only module in the product that writes to Supabase Storage, and the
// only one that hands out a bearer URL for private files.
//
// WHAT IS ACTUALLY BEING TESTED
//
// 1. The signed URL must return the right bytes. `getDocumentDownloadUrl` returning
//    `ok: true` proves a URL was minted, not that the URL serves the file. So the run
//    fetches the URL and compares the body against what was uploaded. A signed URL
//    that 403s, 404s, or serves an empty body passes every other assertion here.
//
// 2. Visibility is derived from the uploader's permission, not from a form field: an
//    employee uploading to their own file gets `private`, an admin uploading on
//    their behalf gets `employee_visible`. Asserting both proves the derivation is
//    live rather than a constant.
//
// 3. The ownership guard. An employee may only upload to their own employee file; the
//    check compares the requested `employee_id` against the caller's own record. The
//    user-visible half is asserted too: another employee's document must not appear
//    on /app/my/documents.
//
// 4. The MIME allow-list and the "no file" refusal, both reachable from the UI.
//
// SAFETY: documents rows AND their storage objects are removed in a `finally`, and
// the removal is asserted by listing the bucket paths back. A row deleted while its
// blob is left behind is worse than no cleanup: the next upload's random UUID does not
// collide, so an orphan just accumulates invisibly.
//
// Usage: node scripts/audit/qa-exercise-documents-workflow.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const MARK = `qadoc${Date.now().toString(36)}`;
const EMPLOYEE_EMAIL = "employee@demo.beepabpo.com";
const HR_EMAIL = "hr@demo.beepabpo.com";
const CLIENT_EMAIL = "clientadmin@demo.beepabpo.com";

// The bytes we will upload, and the exact string we will expect back. A random body
// makes a comparison against the wrong file indistinguishable from a correct one.
const FILE_TEXT = `${MARK} QA document body\nline two\n`;
const FILE_BYTES = Buffer.from(FILE_TEXT, "utf8");

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const userIdFor = (email) => authData.users.find((u) => u.email === email)?.id ?? null;
const employeeUserId = userIdFor(EMPLOYEE_EMAIL);
if (!employeeUserId) throw new Error("demo employee missing");

const employeeRow = (
  await must(db.from("employees").select("id, employee_number").eq("profile_id", employeeUserId).limit(1), "employee row")
)[0];
if (!employeeRow) throw new Error("no employee record for the demo employee");

// A second active employee, so "only your own documents" has something to exclude.
const otherEmployee = (
  await must(
    db.from("employees").select("id, employee_number").eq("employment_status", "active").neq("profile_id", employeeUserId).limit(1),
    "other employee",
  )
)[0];

const countOf = async (t) => (await db.from(t).select("id", { count: "exact", head: true })).count ?? 0;
const beforeCount = await countOf("documents");
console.log(`employee: ${employeeRow.employee_number}; other: ${otherEmployee?.employee_number ?? "none"}`);
console.log(`documents before: ${beforeCount}`);

// Are the pre-existing document rows backed by real storage objects? A metadata row
// whose blob was never uploaded renders a Download button that can only fail, which is
// worth knowing before blaming the signed-URL path for it.
const seededDocs = await must(
  db.from("documents").select("id, title, storage_bucket, storage_path, employee_id, client_organization_id").limit(200),
  "seeded documents",
);
let seededMissingBlobs = 0;
const seededMissing = [];
for (const d of seededDocs) {
  const parts = String(d.storage_path).split("/");
  const { data } = await db.storage
    .from(d.storage_bucket)
    .list(parts.slice(0, -1).join("/") || undefined, { limit: 1000 });
  if (!data?.some((o) => o.name === parts[parts.length - 1])) {
    seededMissingBlobs += 1;
    seededMissing.push(`${d.title} -> ${d.storage_bucket}/${d.storage_path}`);
  }
}
console.log(`pre-existing document rows whose storage object is absent: ${seededMissingBlobs} of ${seededDocs.length}`);
for (const s of seededMissing.slice(0, 5)) console.log(`    missing: ${s}`);
console.log("");

const createdDocIds = new Set();
const createdPaths = new Set(); // "bucket::path", so cleanup can remove the blobs too
const browser = await chromium.launch();
const consoleErrors = [];
const pageErrors = [];

async function signIn(context, email) {
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  return page;
}

async function uploadOn(page, { title, category, name, mimeType, buffer }) {
  await page.fill("#doc-title", title);
  await page.fill("#doc-category", category);
  if (buffer) {
    await page.locator("#doc-file").setInputFiles({ name, mimeType, buffer });
  } else {
    await page.locator("#doc-file").setInputFiles([]);
  }
  await page.getByRole("button", { name: "Upload" }).first().click();
  await page.waitForTimeout(3000);
}

try {
  // ------------------------------------------------------- employee self-upload
  const empCtx = await browser.newContext();
  const empPage = await signIn(empCtx, EMPLOYEE_EMAIL);
  await empPage.goto(`${BASE}/app/my/documents`, { waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1800);

  check("employee sees the upload form", await empPage.locator("#doc-file").isVisible());

  await uploadOn(empPage, {
    title: `${MARK} payslip`,
    category: "payslip",
    name: `${MARK}.txt`,
    mimeType: "text/plain",
    buffer: FILE_BYTES,
  });

  const mine = (
    await must(
      db.from("documents").select("id, title, employee_id, visibility, storage_bucket, storage_path, mime_type, size_bytes").ilike("title", `${MARK}%`).limit(5),
      "document lookup",
    )
  )[0];
  check("uploadEmployeeDocument writes a document row", mine !== undefined, mine?.id.slice(0, 8) ?? "none");

  if (mine) {
    createdDocIds.add(mine.id);
    createdPaths.add(`${mine.storage_bucket}::${mine.storage_path}`);
    check("the document is attached to the uploading employee's record", mine.employee_id === employeeRow.id, String(mine.employee_id));
    check(
      "a self-upload is private",
      mine.visibility === "private",
      String(mine.visibility),
    );
    check("the recorded size matches the uploaded bytes", Number(mine.size_bytes) === FILE_BYTES.length, `${mine.size_bytes} vs ${FILE_BYTES.length}`);

    const docAudit = await must(
      db.from("audit_logs").select("id").eq("entity_id", mine.id).eq("action", "document.upload").limit(1),
      "document audit",
    );
    check("the upload writes an audit row", docAudit.length >= 1, `${docAudit.length} row(s)`);

    // ------------------------------------------------ the signed URL must serve it
    // Anchor on this run's unique title, then walk up to the nearest ancestor that has a
// button in it. /app/my/documents renders a Card per document and every card has an
// identically labelled "Download", so a bare `.first()` clicks whichever sorts first
// -- and here that is a seeded row whose blob does not exist, which returns an error
// instead of a URL and reads as "signed URLs never work".
const docCard = empPage
  .locator(`p:text-is("${MARK} payslip")`)
  .first()
  .locator("xpath=ancestor::div[.//button][1]");
    const downloadBtn = docCard.getByRole("button", { name: "Download" }).first();
    check("a Download control is offered for the document", await downloadBtn.isVisible().catch(() => false));

    // Capture what the component asks the browser to open rather than waiting for a
    // popup event: `window.open(url, "_blank", "noopener,noreferrer")` does not
    // reliably surface as a Playwright popup, and the thing under test is the URL the
    // button resolves, not the browser's window handling.
    await empPage.evaluate(() => {
      window.__qaOpened = [];
      const orig = window.open;
      window.open = (url, ...rest) => {
        window.__qaOpened.push(String(url));
        try {
          return orig.call(window, url, ...rest);
        } catch {
          return null;
        }
      };
    });

    await downloadBtn.click();
    await empPage.waitForTimeout(3000);
    const opened = await empPage.evaluate(() => window.__qaOpened ?? []);
    const signedUrl = opened.find((u) => u.includes("token=")) ?? null;

    check(
      "clicking Download opens a signed URL",
      Boolean(signedUrl),
      signedUrl ? signedUrl.slice(0, 90) : `nothing opened (${opened.length} window.open call(s))`,
    );

    if (!signedUrl) {
      const errText = (await empPage.locator("body").innerText()).replace(/\s+/g, " ");
      note(`No signed URL. Page said: ${(/Unable to[^.]*\./i.exec(errText) ?? ["(no error text)"])[0]}`);
    }

    if (signedUrl) {
      const res = await fetch(signedUrl);
      const body = await res.text();
      check("the signed URL is served successfully", res.ok, `HTTP ${res.status}`);
      check(
        "the signed URL returns exactly the bytes that were uploaded",
        body === FILE_TEXT,
        body === FILE_TEXT ? `${body.length} bytes match` : `got ${JSON.stringify(body.slice(0, 60))}`,
      );
    }

    // The seeded rows are the ones that were broken: before this pass every one of
    // them pointed at a bucket that did not exist, so the documents page looked full
    // and every Download failed. Assert one of those specifically, because "the file
    // I just uploaded downloads" says nothing about them.
    // Pick a seeded row that belongs to THIS employee in the employee bucket. Picking
    // "any seeded document" grabbed a client document, which correctly is not listed
    // here -- so the assertion failed for a reason that had nothing to do with whether
    // downloads work.
    await empPage.reload({ waitUntil: "domcontentloaded" });
    await empPage.waitForTimeout(2000);
    const seededTitle = seededDocs.find(
      (d) => d.employee_id === employeeRow.id && d.storage_bucket === "employee-documents",
    )?.title;
    check(
      "a pre-existing seeded document is listed to this employee",
      Boolean(seededTitle),
      seededTitle ?? `none among ${seededDocs.length} seeded rows`,
    );
    if (seededTitle) {
      const seededCard = empPage
        .locator(`p:text-is(${JSON.stringify(seededTitle)})`)
        .first()
        .locator("xpath=ancestor::div[.//button][1]");
      const seededBtn = seededCard.getByRole("button", { name: "Download" }).first();
      if (await seededBtn.isVisible().catch(() => false)) {
        await empPage.evaluate(() => {
          window.__qaOpened2 = [];
          const orig = window.open;
          window.open = (url, ...rest) => {
            window.__qaOpened2.push(String(url));
            try {
              return orig.call(window, url, ...rest);
            } catch {
              return null;
            }
          };
        });
        await seededBtn.click();
        await empPage.waitForTimeout(3000);
        const openedSeeded = await empPage.evaluate(() => window.__qaOpened2 ?? []);
        const seededUrl = openedSeeded.find((u) => u.includes("token=")) ?? null;
        // Read the toast/alert regions directly. Matching a phrase like "Unable to"
        // in the whole page body missed the real refusal, which is worse than reading
        // whatever the component actually said.
        const toastText = (
          await empPage.locator("[data-sonner-toast], [role=alert], [role=status]").allInnerTexts().catch(() => [])
        ).join(" | ").trim();
        check(
          "a pre-existing seeded document can also be downloaded",
          Boolean(seededUrl),
          seededUrl ? "signed URL minted" : `nothing opened for "${seededTitle}" — page said: ${toastText || "(no toast)"}`,
        );
        if (seededUrl) {
          const r2 = await fetch(seededUrl);
          const bytes = (await r2.arrayBuffer()).byteLength;
          check("the seeded document serves real bytes", r2.ok && bytes > 0, `HTTP ${r2.status}, ${bytes} bytes`);
        }
      } else {
        check("a pre-existing seeded document can also be downloaded", false, `"${seededTitle}" is not listed to this employee`);
      }
    }
  }

  // ------------------------------------------------------------- guard refusals
  await empPage.reload({ waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1500);
  await uploadOn(empPage, {
    title: `${MARK} executable`,
    category: "other",
    name: `${MARK}.exe`,
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("MZ fake executable"),
  });
  const afterBad = await must(
    db.from("documents").select("id").ilike("title", `${MARK} executable`),
    "bad mime lookup",
  );
  const badText = (await empPage.locator("body").innerText()).replace(/\s+/g, " ");
  check(
    "a disallowed MIME type is refused and writes nothing",
    afterBad.length === 0 && /Allowed types|Choose a file/i.test(badText),
    afterBad.length === 0 ? "no row written" : `${afterBad.length} row(s) written`,
  );

  await empPage.reload({ waitUntil: "domcontentloaded" });
  await empPage.waitForTimeout(1500);
  await uploadOn(empPage, { title: `${MARK} no file`, category: "other", buffer: null });
  const afterNoFile = await must(db.from("documents").select("id").ilike("title", `${MARK} no file`), "no-file lookup");
  check("an upload with no file is refused and writes nothing", afterNoFile.length === 0, `${afterNoFile.length} row(s)`);
  await empCtx.close();

  // ------------------------------------------- admin upload on another's behalf
  const hrCtx = await browser.newContext();
  const hrPage = await signIn(hrCtx, HR_EMAIL);
  if (otherEmployee) {
    await hrPage.goto(`${BASE}/app/employees/${otherEmployee.id}`, { waitUntil: "domcontentloaded" });
    await hrPage.waitForTimeout(1800);
    const hasForm = await hrPage.locator("#doc-file").isVisible().catch(() => false);
    check("HR sees an upload form on another employee's record", hasForm);

    if (hasForm) {
      await uploadOn(hrPage, {
        title: `${MARK} HR uploaded contract`,
        category: "contract",
        name: `${MARK}-hr.txt`,
        mimeType: "text/plain",
        buffer: FILE_BYTES,
      });
      const hrDoc = (
        await must(
          db.from("documents").select("id, employee_id, visibility, storage_bucket, storage_path").ilike("title", `${MARK} HR uploaded%`).limit(1),
          "hr doc lookup",
        )
      )[0];
      check("the admin upload writes a document", hrDoc !== undefined, hrDoc?.id.slice(0, 8) ?? "none");
      if (hrDoc) {
        createdDocIds.add(hrDoc.id);
        createdPaths.add(`${hrDoc.storage_bucket}::${hrDoc.storage_path}`);
        check("it is attached to the employee HR chose, not to HR", hrDoc.employee_id === otherEmployee.id, String(hrDoc.employee_id));
        check(
          "an upload made on someone's behalf is employee_visible, not private",
          hrDoc.visibility === "employee_visible",
          String(hrDoc.visibility),
        );
      }
    }
  }
  await hrCtx.close();

  // ----------------------------------------- the employee must not see that doc
  const empCtx2 = await browser.newContext();
  const empPage2 = await signIn(empCtx2, EMPLOYEE_EMAIL);
  await empPage2.goto(`${BASE}/app/my/documents`, { waitUntil: "domcontentloaded" });
  await empPage2.waitForTimeout(1800);
  const leaked = await empPage2.getByText(`${MARK} HR uploaded contract`).count();
  check("another employee's document is not listed to this employee", leaked === 0, `${leaked} shown`);
  check(
    "the employee still sees their own document",
    (await empPage2.getByText(`${MARK} payslip`).count()) > 0,
  );
  await empCtx2.close();

  // ------------------------------------------------------- client-side upload
  const cliCtx = await browser.newContext();
  const cliPage = await signIn(cliCtx, CLIENT_EMAIL);
  await cliPage.goto(`${BASE}/app/client/documents`, { waitUntil: "domcontentloaded" });
  await cliPage.waitForTimeout(1800);

  const clientFormVisible = await cliPage.locator("#doc-file").isVisible().catch(() => false);
  check("client admin sees the upload form", clientFormVisible);
  if (clientFormVisible) {
    await uploadOn(cliPage, {
      title: `${MARK} client contract`,
      category: "contract",
      name: `${MARK}-client.txt`,
      mimeType: "text/plain",
      buffer: FILE_BYTES,
    });
    const cliDoc = (
      await must(
        db.from("documents").select("id, client_organization_id, visibility, storage_bucket, storage_path").ilike("title", `${MARK} client contract`).limit(1),
        "client doc lookup",
      )
    )[0];
    check("uploadClientDocument writes a document", cliDoc !== undefined, cliDoc?.id.slice(0, 8) ?? "none");
    if (cliDoc) {
      createdDocIds.add(cliDoc.id);
      createdPaths.add(`${cliDoc.storage_bucket}::${cliDoc.storage_path}`);
      check("the client document is tied to a client organization", Boolean(cliDoc.client_organization_id), String(cliDoc.client_organization_id));
      check("a client upload is client_visible", cliDoc.visibility === "client_visible", String(cliDoc.visibility));

      const cliAudit = await must(
        db.from("audit_logs").select("id").eq("entity_id", cliDoc.id).eq("action", "document.upload_client").limit(1),
        "client doc audit",
      );
      check("the client upload writes an audit row", cliAudit.length >= 1, `${cliAudit.length} row(s)`);
    }
  }
  await cliCtx.close();

  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  // Metadata first, then the blobs it pointed at.
  for (const id of createdDocIds) await db.from("documents").delete().eq("id", id);

  const byBucket = new Map();
  for (const key of createdPaths) {
    const [bucket, ...rest] = key.split("::");
    const path = rest.join("::");
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(path);
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket.entries()) {
    const { error } = await db.storage.from(bucket).remove(paths);
    if (!error) removed += paths.length;
    else console.error(`(cleanup) could not remove ${paths.length} object(s) from ${bucket}: ${error.message}`);
  }
  console.log(`\n(cleanup) document rows removed: ${createdDocIds.size}; storage objects removed: ${removed}`);

  const leftoverRows = await must(db.from("documents").select("id").ilike("title", `${MARK}%`), "leftover docs");
  console.log(`(cleanup) document rows still carrying the marker: ${leftoverRows.length}`);

  // Assert the blobs are actually gone, not just that remove() returned.
  let leftoverObjects = 0;
  for (const [bucket, paths] of byBucket.entries()) {
    for (const path of paths) {
      const { data } = await db.storage.from(bucket).list(path.split("/").slice(0, -1).join("/") || undefined, { limit: 1000 });
      if (data?.some((o) => o.name === path.split("/").pop())) leftoverObjects += 1;
    }
  }

  const afterCount = await countOf("documents");
  console.log(`(cleanup) documents ${beforeCount} -> ${afterCount}; orphaned storage objects: ${leftoverObjects}`);

  check("no document row is left carrying the marker", leftoverRows.length === 0, `${leftoverRows.length} row(s)`);
  check("no storage object is orphaned", leftoverObjects === 0, `${leftoverObjects} orphan(s)`);
  check("the documents table is back to its starting size", afterCount === beforeCount, `${afterCount} vs ${beforeCount}`);

  const restored = leftoverRows.length === 0 && leftoverObjects === 0 && afterCount === beforeCount;
  console.log(`the sweep left the demo data as it found it: ${restored ? "yes" : "NO"}`);
  if (!restored) process.exitCode = 1;

  await browser.close().catch(() => {});

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} assertions passed`);
  if (passed !== results.length) process.exitCode = 1;
  if (notes.length) {
    console.log("\nnotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }
}