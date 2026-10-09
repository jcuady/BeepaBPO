import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Explicit id: without it the browser derives identity from start_url, so
    // any later start_url change makes this look like a brand-new app and the
    // user gets a second install prompt alongside the first.
    id: "/app",
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    // Employees install the app to reach their workspace, not the marketing site.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F5F7F6",
    theme_color: "#1F2058",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
