import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beepabpo.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Beepa BPO | People. Process. Progress.",
    template: "%s | Beepa BPO",
  },
  description:
    "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
  applicationName: "Beepa",
  authors: [{ name: "Beepa BPO", url: siteUrl }],
  creator: "Beepa BPO",
  publisher: "Beepa BPO",
  category: "business",
  keywords: [
    "BPO",
    "outsourcing",
    "Beepa",
    "virtual assistants",
    "customer support",
    "Philippines BPO",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/icon-192.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Beepa BPO",
    title: "Beepa BPO | People. Process. Progress.",
    description:
      "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
    images: [
      {
        url: "/images/og.png",
        width: 1672,
        height: 941,
        alt: "Beepa BPO — People. Process. Progress.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Beepa BPO | People. Process. Progress.",
    description:
      "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
    images: ["/images/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Beepa",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1F2058",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
