// Shared design tokens for the marketing/landing surfaces.
// Keep these tiny — they get composed into a `cn()` call site.
//
// focusRing — single source of truth for keyboard focus on links/cards/buttons
//   in the public marketing site. The brand uses a 2px green ring with a 2px
//   offset, matching the design system.
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

// For surfaces that sit on a navy footer (no light offset).
export const focusRingNavy =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy";
