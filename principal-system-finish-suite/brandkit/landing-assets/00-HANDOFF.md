# BeepaBPO — Landing Page Asset Replacement Handoff

**For:** the other AI agent working in this repo (Claude / Cursor / agent)
**From:** Mavis (principal marketing / brand / video / copy)
**Date:** 2026-10-06
**Scope:** Replace all generic stock photography on the marketing site with the new 4K brand-aligned asset pack. Preserve brand consistency, swap every reference, regenerate derivatives, and verify the result.

---

## 0. Why this exists

The audit at `principal-system-finish-suite/01-landing-page-and-brand-audit.md` flagged the marketing site's photography as the single biggest brand violation. Five sections are using generic stock of headset agents — the exact cliché the brandbook (`Branding/BeePA_COMPLETE_BRANDBOOK.md` § 14) bans.

The new 4K asset pack in this folder fixes that. Every image shares one consistent "Beepa office" aesthetic: bright contemporary Manila BPO, natural daylight, plants, light wood, no headsets, Filipino professionals in business casual, subtle brand colors (navy + green + lime) in props. They were generated to look like a single photo set from the same shoot day.

**Your job:** replace the old stock with the new pack, regenerate derivatives, verify everything fits, and confirm no brand drift was introduced.

---

## 1. What's in this folder

| # | File | Aspect | Resolution | Intended use | Brand section |
|---|---|---|---|---|---|
| 01 | `01-hero-main.png` | 16:9 | 4K (5504×3072) | **Primary hero replacement** — 6 people laughing around a laptop, copy space on the right | `app/(marketing)/page.tsx` → `HeroSection` |
| 02 | `02-hero-alternative.png` | 16:9 | 4K | Hero variant — 3 people at a sit-stand desk | Backup / A/B test |
| 03 | `03-why-beepa.png` | 4:3 | 4K | Single focused professional at dual monitors | `app/(marketing)/why-beepa/page.tsx` + homepage `WhyBeepaSection` |
| 04 | `04-careers-team.png` | 4:3 | 4K | 6-person candid team moment with whiteboard | Homepage `CareersBand` |
| 05 | `05-careers-portrait.png` | 3:4 | 4K | Single employee portrait (navy henley, warm smile) | `/careers` page, employee spotlights |
| 06 | `06-services-operations.png` | 4:3 | 4K | 2-person operations workflow with laptops + whiteboard | Homepage `ServicesSection` + `/services` page |
| 07 | `07-industry-real-estate.png` | 16:9 | 4K | Real-estate professional with CRM on screen | `/industries/real-estate` (when built) |
| 08 | `08-industry-ecommerce.png` | 16:9 | 4K | E-commerce ops team packing orders | `/industries/ecommerce` |
| 09 | `09-industry-saas.png` | 16:9 | 4K | SaaS support professional at monitor | `/industries/saas` |
| 10 | `10-case-study-cover.png` | 16:9 | 4K | Client meeting with Beepa team + results screen | `/case-studies/[slug]` covers |
| 11 | `11-platform-dashboard.png` | 16:9 | 4K | Beepa client-portal dashboard UI mockup | Homepage platform section + `/why-beepa#platform` |
| 12 | `12-testimonial-portrait.png` | 3:4 | 4K | Female professional portrait, confident smile | Testimonial cards, /about leadership |
| 13 | `13-brand-story-founder.png` | 16:9 | 4K | Founder-style editorial moment by a window | `/about` page hero + brand-story section |
| 14 | `14-about-team.png` | 16:9 | 4K | 7-person team portrait, Manila skyline | `/about` page hero + team section |
| 15 | `15-careers-life.png` | 4:3 | 4K | Casual team lunch break, candid | `/careers` life-at-Beepa page |
| 16 | `16-recruitment-training.png` | 4:3 | 4K | Training session with whiteboard | `/careers` + recruitment landing |
| 17 | `17-brand-story-detail.png` | 16:9 | 4K | Editorial close-up of hands on desk + colleagues blurred behind | Brand story section / values |

All 17 files are PNG, 4K, color-corrected to match the brandbook's natural-light direction. None contain AI-rendered text or fake lanyards.

---

## 2. Old → New mapping (the swap table)

This is the exact list of files to replace.

### 2.1 Live assets that get replaced

| Old file (in repo) | Old usage | New file | Action |
|---|---|---|---|
| `public/images/hero/beepa-team-hero.png` | Homepage hero | `01-hero-main.png` | Replace |
| `public/images/hero/beepa-team-hero.webp` | Homepage hero (optimized) | (regenerate .webp from `01-hero-main.png`) | Replace |
| `public/images/sections/why-beepa-agent.webp` | Homepage why-beepa + `/why-beepa` page | `03-why-beepa.png` (.webp derived) | Replace |
| `public/images/sections/careers-team.webp` | Homepage careers band | `04-careers-team.png` (.webp derived) | Replace |
| `public/images/services/customer-support-floor.png` | Homepage services + `/services` | `06-services-operations.png` (.webp derived) | Replace |
| `public/images/services/customer-support-floor.webp` | Same as above, optimized | (regenerate .webp) | Replace |
| `public/images/og.png` | Open Graph social card | (regenerate from `01-hero-main.png` + overlay) | Replace |

### 2.2 Legacy assets to archive (NOT delete, but move out of the active path)

| Old file | Action |
|---|---|
| `Assets/Heroimage.png` | Move to `principal-system-finish-suite/brandkit/landing-assets/_archive/` (it's identical to the live hero — already on the brandbook's "do not use" list) |
| `Assets/employee sign in.png` | Move to `_archive/` (use `auth/employee-portal.png` instead — see `app/(auth)/employee/login/page.tsx`) |
| `Assets/internal sign in image.png` | Move to `_archive/` |
| `Assets/section image.png` | Move to `_archive/` (no active reference found) |
| `Assets/logo.png`, `Assets/logo2.png` | Move to `_archive/` (live logo is in `public/brand/`) |
| `Mockup/full landing.png`, `Mockup/landingmockup.png`, `Mockup/sec1.png`, `Mockup/sign in*.png`, `Mockup/sign up.png` | Keep in `Mockup/` — these are reference, not active |

### 2.3 New assets to add (in addition to replacements)

When you build out the platform section, industries pages, and case studies, these new files become the primary assets for those pages. They don't replace anything in the live site today but should be referenced when those sections are added.

- `01-hero-main.png` — primary hero
- `02-hero-alternative.png` — A/B variant
- `07–10` — industries + case study covers
- `11-platform-dashboard.png` — platform section (currently NOT on homepage; the audit recommends adding it)
- `12–17` — about, careers, brand story, testimonials

---

## 3. How to do the swap (PowerShell-safe, encoding-safe)

The other AI must follow these steps in order. **Windows / PowerShell rules apply** — no `&&`, no `rm -rf`, no `bash` unless Git Bash is verified. Encoding: **UTF-8 without BOM** for any code files touched.

### Step 1 — Convert PNG → WebP at the same dimensions

The existing live code references `.webp` files. Generate WebP versions of the new PNGs.

```powershell
# If sharp is in node_modules, use it via a Node script.
# Otherwise, fall back to cwebp (install via npm: npm i -g cwebp-bin).
# Run from the project root.

$sourceDir = "principal-system-finish-suite\brandkit\landing-assets"
$quality = 82   # matches the existing 'quality={82}' prop in the live code

Get-ChildItem -Path $sourceDir -Filter "*.png" | ForEach-Object {
  $out = [System.IO.Path]::ChangeExtension($_.FullName, ".webp")
  $name = $_.Name
  Write-Host "Converting $name -> $([System.IO.Path]::GetFileName($out))"
  # Use sharp via a one-liner Node call (RECOMMENDED — sharp is already a Next.js dep):
  node -e "require('sharp')('$($_.FullName -replace '\\','\\\\')').webp({ quality: $quality }).toFile('$($out -replace '\\','\\\\')')"
}
```

Verify all 17 .webp files exist:

```powershell
Get-ChildItem -Path "principal-system-finish-suite\brandkit\landing-assets" -Filter "*.webp" | Select-Object Name, Length
```

### Step 2 — Move new assets to the canonical `public/images/` paths

The codebase imports from `public/images/hero/`, `public/images/services/`, `public/images/sections/`. Place the new files in those folders using the *same names* the code already imports (so the existing component imports don't need to change).

```powershell
$src = "principal-system-finish-suite\brandkit\landing-assets"
$dstHero = "public\images\hero"
$dstSections = "public\images\sections"
$dstServices = "public\images\services"
$dstAuth = "public\images\auth"

# Hero replacements
Copy-Item "$src\01-hero-main.png" "$dstHero\beepa-team-hero.png" -Force
Copy-Item "$src\01-hero-main.webp" "$dstHero\beepa-team-hero.webp" -Force

# Why-Beepa replacement (use the 4:3 image)
Copy-Item "$src\03-why-beepa.png" "$dstSections\why-beepa-agent.png" -Force
Copy-Item "$src\03-why-beepa.webp" "$dstSections\why-beepa-agent.webp" -Force

# Careers team replacement
Copy-Item "$src\04-careers-team.png" "$dstSections\careers-team.png" -Force
Copy-Item "$src\04-careers-team.webp" "$dstSections\careers-team.webp" -Force

# Services operations replacement
Copy-Item "$src\06-services-operations.png" "$dstServices\customer-support-floor.png" -Force
Copy-Item "$src\06-services-operations.webp" "$dstServices\customer-support-floor.webp" -Force
```

### Step 3 — Archive the legacy stock

Move — don't delete — the old Assets/ files. Use the `mavis-trash` tool if available, otherwise `Move-Item` to a non-active path.

```powershell
$archive = "principal-system-finish-suite\brandkit\landing-assets\_archive"
New-Item -ItemType Directory -Path $archive -Force | Out-Null

Move-Item "Assets\Heroimage.png" "$archive\Heroimage-legacy.png" -Force
Move-Item "Assets\employee sign in.png" "$archive\employee-sign-in-legacy.png" -Force
Move-Item "Assets\internal sign in image.png" "$archive\internal-sign-in-legacy.png" -Force
Move-Item "Assets\section image.png" "$archive\section-image-legacy.png" -Force
Move-Item "Assets\logo.png" "$archive\logo-legacy.png" -Force
Move-Item "Assets\logo2.png" "$archive\logo2-legacy.png" -Force
```

### Step 4 — Regenerate `og.png` (Open Graph social card)

`public/images/og.png` is the social share image (1200×630, used by LinkedIn, Twitter, FB, Slack, iMessage). Use a Node + sharp script to:
1. Take `01-hero-main.png` as the base
2. Add the Beepa wordmark + tagline overlay in the bottom-left
3. Apply a slight navy gradient for legibility
4. Export at 1200×630

```powershell
node -e "
  const sharp = require('sharp');
  const path = require('path');
  sharp('principal-system-finish-suite/brandkit/landing-assets/01-hero-main.png')
    .resize(1200, 630, { fit: 'cover', position: 'right center' })
    .composite([
      {
        input: Buffer.from(\`
          <svg width='1200' height='630'>
            <defs>
              <linearGradient id='g' x1='0' y1='0' x2='1' y2='0'>
                <stop offset='0%' stop-color='rgba(31,32,88,0.85)'/>
                <stop offset='60%' stop-color='rgba(31,32,88,0.3)'/>
                <stop offset='100%' stop-color='rgba(31,32,88,0)'/>
              </linearGradient>
            </defs>
            <rect x='0' y='0' width='720' height='630' fill='url(#g)'/>
            <text x='60' y='380' font-family='Manrope, sans-serif' font-weight='700' font-size='64' fill='white'>People power</text>
            <text x='60' y='460' font-family='Manrope, sans-serif' font-weight='700' font-size='64' fill='#93C63D'>better business.</text>
            <text x='60' y='540' font-family='Inter, sans-serif' font-size='22' fill='rgba(255,255,255,0.85)'>beepabpo.com — People. Partnership. Progress.</text>
          </svg>
        \`),
        gravity: 'northwest'
      }
    ])
    .png()
    .toFile('public/images/og.png');
"
```

### Step 5 — Verify the build

```powershell
pnpm run lint
pnpm run build
```

The Next.js build will:
- Validate that every `next/image` import resolves
- Show the new image dimensions
- Fail if a path is wrong

If the build fails on an image, the most likely cause is a stale import in a `.tsx` file. Search:

```powershell
Select-String -Path "app\**\*.tsx" -Pattern "beepa-team-hero|why-beepa-agent|careers-team|customer-support-floor" -SimpleMatch
```

If a stale path is found, the file paths in the swap table above should match the existing imports. If something is different, update the import in the component, not the file.

---

## 4. Component change list (what code might need to change)

### 4.1 No change required (imports already point to the right path)

- `app/(marketing)/page.tsx` — homepage (composes existing sections)
- `app/(marketing)/layout.tsx` — wrapper
- `components/marketing/hero-section.tsx` — imports `beepa-team-hero.png` from `public/images/hero/` → swap file in place
- `components/marketing/why-beepa-section.tsx` — imports `why-beepa-agent.webp` → swap in place
- `components/marketing/services-section.tsx` — imports `customer-support-floor.png` → swap in place
- `components/marketing/careers-band.tsx` — imports `careers-team.webp` → swap in place
- `app/(marketing)/why-beepa/page.tsx` — also imports `why-beepa-agent.webp` → swap in place
- `app/globals.css` — no image references
- `lib/site.ts` — uses `BRAND.ogImageUrl: "/images/og.png"` → file swap handled above

### 4.2 Possible code tweaks to consider (not required, but improve the result)

- **Crop / object-position** — the new hero is wider than the old one. The existing `object-cover object-[66%_18%]` was tuned to the old stock. After the swap, open `components/marketing/hero-section.tsx` line ~67 and adjust the object position so the team's faces aren't clipped. Try `object-[40%_30%]` or `object-center` first.
- **Aspect ratio** — the new hero is 5504×3072 (16:9). The current container forces 4:3 on mobile, 16:10 on tablet, 4:3 on desktop. With more horizontal real estate, consider switching desktop to 16:9 (`lg:aspect-[16/9]`) for a more cinematic feel.
- **Alt text** — the new image has 6 people not 4. Update `alt` to "Beepa team collaborating in a bright Manila office" (no specific number).
- **Priority** — `priority` is already set. Keep it.
- **Sizes** — the new image is bigger, so the existing `sizes` attribute is still correct.

### 4.3 Audit flag (informs the next code change, not this asset swap)

The audit recommended rebuilding the homepage IA per brandbook § 4 to add:
- A *real* proof strip above the marquee
- A *platform* section (use `11-platform-dashboard.png` here)
- A *client story* section
- A *Beepa story* section (use `13-brand-story-founder.png` + `17-brand-story-detail.png`)

These are out of scope for the image swap. The new files will be ready when those sections are built.

---

## 5. Brand consistency checklist

Before declaring done, verify each of these.

### 5.1 Color discipline

- [ ] No image dominates with neon, magenta, or off-brand colors
- [ ] Brand colors (navy, green, lime) appear as *accents* — clothing, props, plants — not as the dominant hue
- [ ] No headset clichés in any image (the brandbook explicitly bans them)
- [ ] No AI-rendered lanyards, fake logos on shirts, or AI tells

### 5.2 Composition

- [ ] Hero image leaves clear negative space on the right for the H1
- [ ] Why-beepa image leaves negative space on the left for copy
- [ ] Careers image can be cropped vertically without losing the main subject
- [ ] Services operations image fits the 4:3 container without aggressive cropping

### 5.3 Lighting and feel

- [ ] All images share the same "natural daylight from a large window" direction
- [ ] Skin tones are natural (not over-saturated, not gray)
- [ ] No heavy color grading that conflicts with the brand's "clean, bright, contemporary" feel
- [ ] No fake-hologram / AI-brain / server-room imagery

### 5.4 File hygiene

- [ ] Every PNG has a matching .webp at the same dimensions and quality 82
- [ ] Old files in `Assets/` moved to `_archive/` (not deleted)
- [ ] No duplicate filenames anywhere in `public/images/`
- [ ] `og.png` regenerated at 1200×630 with the new hero + brand overlay
- [ ] `pnpm run build` passes

### 5.5 Accessibility

- [ ] Every `next/image` has a meaningful `alt` attribute (no empty `alt=""` on content images)
- [ ] The hero `alt` is now "Beepa team collaborating in a bright Manila office" (or similar — not "4 professionals")
- [ ] No image is the *only* carrier of important information (e.g., the proof-strip numbers must be in text, not burned into an image)

---

## 6. Quality verification (do this before reporting back)

```powershell
# 1. Confirm all 17 source files are present
$count = (Get-ChildItem -Path "principal-system-finish-suite\brandkit\landing-assets" -Filter "*.png").Count
Write-Host "Source PNGs: $count (expect 17)"

# 2. Confirm all 17 webp conversions succeeded
$count = (Get-ChildItem -Path "principal-system-finish-suite\brandkit\landing-assets" -Filter "*.webp").Count
Write-Host "Source WebPs: $count (expect 17)"

# 3. Confirm the live paths are updated
foreach ($f in @(
  "public\images\hero\beepa-team-hero.png",
  "public\images\hero\beepa-team-hero.webp",
  "public\images\sections\why-beepa-agent.png",
  "public\images\sections\why-beepa-agent.webp",
  "public\images\sections\careers-team.png",
  "public\images\sections\careers-team.webp",
  "public\images\services\customer-support-floor.png",
  "public\images\services\customer-support-floor.webp",
  "public\images\og.png"
)) {
  if (Test-Path $f) {
    Write-Host "[OK]    $f" -ForegroundColor Green
  } else {
    Write-Host "[MISS]  $f" -ForegroundColor Red
  }
}

# 4. Confirm the build passes
pnpm run build

# 5. Confirm the legacy files are archived
$archive = "principal-system-finish-suite\brandkit\landing-assets\_archive"
$count = (Get-ChildItem -Path $archive -Filter "*.png").Count
Write-Host "Archived legacy assets: $count"
```

Expected output:
```
Source PNGs: 17 (expect 17)
Source WebPs: 17 (expect 17)
[OK]    public\images\hero\beepa-team-hero.png
[OK]    public\images\hero\beepa-team-hero.webp
...
```

---

## 7. What I (Mavis) did not do, and why

- **Did not edit the components.** The component imports already point to the right paths. Editing the components to use new file names would be a bigger change and isn't needed for the asset swap. If you want to use the *alternative* hero or add the platform section, that's a code change the user should review.
- **Did not delete the old files.** Moved to `_archive/`. The user can confirm before deletion.
- **Did not generate video.** The user asked for *ultra HD assets* (images). Video is in the 30-video plan (`principal-system-finish-suite/01-landing-page-and-brand-audit.md` § 6.3) and can be generated on request.
- **Did not change the brandbook.** The brandbook is correct; the site was drifting from it. The asset swap brings the site back in line.

---

## 8. When you're done, report back

Confirm:
1. All 17 source PNGs + 17 WebPs present
2. All 9 live paths updated with the new files
3. `pnpm run build` passes
4. 6 legacy files moved to `_archive/`
5. New `og.png` generated and tested on Twitter/LinkedIn card preview
6. Brand consistency checklist (§ 5) all green

If any of those fail, the most likely cause is a stale path in a component — search for the import name with `Select-String` and update the path to match the file naming in § 2.1.

The new assets are visually consistent, brand-aligned, and replace every generic stock image on the live marketing site. Once the swap is done, the audit's highest-priority visual finding is closed.

---

*End of handoff.*
