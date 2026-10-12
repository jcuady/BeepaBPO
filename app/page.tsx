import type { Metadata } from "next";
import LandingPage from "@/components/landing/landing-page";
import { faqs } from "@/components/landing/content";
import {
  JsonLd,
  organizationJsonLd,
  servicesItemListJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";

/**
 * The landing page.
 *
 * This route deliberately lives at `app/page.tsx`, OUTSIDE the `(marketing)`
 * route group. The reference design ships its own header and footer, and
 * `app/(marketing)/layout.tsx` injects the shared `SiteHeader` / `SiteFooter`
 * into every route inside the group — so a landing page in that group would
 * render both sets of chrome. The other marketing routes keep the shared chrome
 * and are unchanged.
 *
 * The title and description below are taken verbatim from the reference's route
 * `head()` and replace the generic `BRAND.title` this page used to publish. The
 * brand name is still applied by the root layout's `%s | <name>` template, and
 * the structured data below still reads its canonical URLs and logo from
 * `BRAND`, so the page stays inside the brand's SEO contract.
 */
export const metadata: Metadata = {
  title: "Filipino talent. Built around your business.",
  description:
    "Build a dedicated Filipino team with Beepa BPO. Customer support, virtual assistants, back office, sales, IT, marketing and more—with web and mobile visibility into your people, payroll and performance.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Your people. Your advantage.",
    description:
      "Exceptional Filipino talent, a dedicated team, and full transparency. Discover outsourcing with Beepa BPO and explore careers.",
  },
};

/**
 * `FAQPage` built from the same list the page renders.
 *
 * `faqItems` is imported from `./content` rather than retyped here. The earlier
 * version of this page read its FAQs out of the CMS and built the JSON-LD from
 * that same array; when the page was replaced, the structured data would have
 * silently gone with it — it renders nothing on screen, so nothing fails until
 * a rich-result check does. Sharing one array is what keeps it honest.
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function Page() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={servicesItemListJsonLd()} />
      <JsonLd data={faqJsonLd} />
      <LandingPage />
    </>
  );
}