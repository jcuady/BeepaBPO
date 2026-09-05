import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://beepabpo.com",
  ),
  title: {
    default: "Beepa BPO | People. Process. Progress.",
    template: "%s | Beepa BPO",
  },
  description:
    "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Beepa BPO",
    title: "Beepa BPO | People. Process. Progress.",
    description:
      "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
    images: [{ url: "/images/og.png", width: 1672, height: 941 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Beepa BPO | People. Process. Progress.",
    description:
      "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
    images: ["/images/og.png"],
  },
  robots: { index: true, follow: true },
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
