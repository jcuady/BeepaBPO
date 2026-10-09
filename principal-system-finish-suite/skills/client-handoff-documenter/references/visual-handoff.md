# Visual Handoff Workflow

Use this workflow when the delivered system has a user interface and the client needs page-by-page visual documentation.

## 1. Prepare a safe capture environment

- Use a local, test, demo, or approved staging environment that matches the release candidate.
- Use seeded synthetic data that demonstrates realistic states without exposing personal, financial, health, credential, or production information.
- Record the application version, base URL class, capture date, browser engine, and viewport sizes. Never print real passwords, tokens, internal headers, or secrets.
- Start the app with the repository's documented commands. Confirm the release candidate and migrations before capturing.
- Prefer Cursor's browser/screenshot capability when available. If it cannot automate the complete inventory, use the project's existing Playwright or Puppeteer setup. Add a browser dependency only when necessary and compatible.

## 2. Build the capture manifest

Create `docs/handoff/page-capture-manifest.json`. Derive it from actual route definitions, navigation, the system inventory, and the role matrix—not from memory.

Each entry should identify:

```json
{
  "id": "001",
  "page": "Dashboard",
  "route": "/dashboard",
  "role": "Administrator",
  "viewport": "desktop-1440x1000",
  "state": "representative",
  "status": "captured",
  "screenshot": "screenshots/001-administrator-dashboard-desktop.png",
  "notes": "Primary operational overview"
}
```

Use `planned`, `captured`, `blocked`, `excluded`, or `failed` for status. An exclusion requires a reason. Every in-scope client-facing page must have at least one manifest entry.

Capture separate entries when a role sees materially different content or permissions. Also capture distinct desktop, tablet, or mobile variants when that form factor is part of the actual product or the layout materially changes. Avoid redundant variants that add no handoff value.

Include important modal, drawer, wizard, empty, error, approval, or detail states when they represent a workflow the client must understand. Do not inflate coverage with every trivial hover state.

## 3. Capture the running product

For each manifest entry:

1. Authenticate as the intended role using a safe account.
2. Navigate through the product where practical; also verify direct-route access.
3. Set the declared viewport and wait for fonts, images, network requests, loading states, and intentional animation to settle.
4. Dismiss development overlays, cookie prompts, and transient notifications unless they are the subject of the capture.
5. Confirm the page has representative content and no sensitive data.
6. Capture the full page or a stable viewport crop that keeps text legible. Use consistent browser scale.
7. Save deterministic PNG filenames under `docs/handoff/screenshots/`.
8. Open the captured image and check cropping, overlays, blank regions, broken assets, and exposed sensitive content before setting `status` to `captured`.

Do not mark a broken or inaccessible page as captured. Record it as `failed` or `blocked`, link the defect, and continue with other pages.

## 4. Generate the HTML manual

Create `docs/client-handoff.html` as a professional, branded, accessible document that works when opened locally. Use the project's approved logo, color tokens, fonts, and product name. If brand assets are absent, use a restrained neutral system rather than inventing a new brand.

Include:

- cover, version, prepared date, and confidentiality label when required;
- table of contents with internal links;
- system purpose and scope;
- role legend and workflow overview;
- one documented section per manifest page with page name, route, intended roles, purpose, screenshot, primary actions, validation or permission notes, and common recovery guidance;
- known limitations and client action items;
- support and escalation information;
- appendix containing the capture coverage summary.

Use semantic headings, descriptive image alt text, captions, visible page identifiers, and print-safe contrast. Keep screenshot width consistent and preserve aspect ratio. Link to local image assets or embed them when a single-file deliverable is explicitly needed. Verify that all image references resolve from the HTML file's location.

Add print CSS. Use intentional page breaks before major sections and prevent headings, captions, or screenshots from being orphaned. Prefer A4 landscape for wide dashboard screenshots unless the content is clearly better in portrait.

## 5. Convert HTML to PDF

Prefer the project's existing browser automation. A typical Chromium/Playwright export uses background printing and CSS page size:

```js
await page.goto(htmlFileUrl, { waitUntil: "networkidle" });
await page.pdf({
  path: "docs/client-handoff.pdf",
  format: "A4",
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
});
```

Adapt the command to the current stack. Do not install or switch document-generation frameworks when the available browser can reliably print the HTML.

## 6. Verify the deliverables

- Open the HTML locally and test the table of contents, images, internal links, and representative responsive widths.
- Render or inspect every PDF page. Check missing images, clipping, unreadable scaling, accidental blank pages, broken page breaks, inconsistent headers/footers, and content outside margins.
- Compare the manifest against the HTML sections and PDF output. Account for every planned page.
- Check that the screenshots correspond to the stated roles and release candidate.
- Record capture totals by status and list any blocked/excluded pages in `docs/client-handoff.md`.

The visual handoff is complete only when all in-scope manifest entries are captured or explicitly blocked/excluded, the HTML is usable, and every PDF page has passed visual inspection.
