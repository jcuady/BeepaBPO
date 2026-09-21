/**
 * Canonical marketing services catalog.
 * CMS rows with matching slugs override copy; missing slugs always fall back here.
 */
export type ServiceCatalogItem = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  /** Homepage rail one-liner */
  hook: string;
  /** Footer / nav short label */
  shortLabel: string;
};

export const SERVICES_CATALOG = [
  {
    slug: "customer-support",
    title: "Customer Support",
    summary:
      "Frontline voice, chat, and email talent who represent your brand — placed on your team, paid through Beepa.",
    description:
      "We source and place support professionals who match your hours, tools, and tone. You manage the work; we handle employment pay.",
    hook: "Voice, chat, and email on your hours.",
    shortLabel: "Customer support",
  },
  {
    slug: "back-office",
    title: "Back Office Support",
    summary:
      "Ops talent for accurate day-to-day work — data, admin, and process execution without fixed headcount drag.",
    description:
      "Tell us the workflows. We find people who can execute them reliably, then manage salary so your core team stays focused on growth.",
    hook: "Data, admin, and process work.",
    shortLabel: "Back office",
  },
  {
    slug: "virtual-assistants",
    title: "Virtual Assistants",
    summary:
      "Administrative partners for calendars, inboxes, research, and priority follow-through.",
    description:
      "VA roles filled through Beepa’s manpower model: screened talent, clear placement, salary handled on our side.",
    hook: "Calendars, inboxes, follow-through.",
    shortLabel: "Virtual assistants",
  },
  {
    slug: "sales-support",
    title: "Sales Support",
    summary:
      "Research, outreach, and pipeline support that extends your revenue team.",
    description:
      "We place sales-support talent who fit your CRM and cadence. You own the pipeline; we own finding people and paying them.",
    hook: "Research, outreach, and pipeline.",
    shortLabel: "Sales support",
  },
  {
    slug: "it-support",
    title: "IT Support",
    summary:
      "Helpdesk and desktop support talent who keep tools running for your team.",
    description:
      "We place IT support professionals who know your stack and hours. You direct the tickets; we handle hiring and pay.",
    hook: "Helpdesk and desktop coverage.",
    shortLabel: "IT support",
  },
  {
    slug: "marketing",
    title: "Marketing",
    summary:
      "Content, campaign, and channel support that extends your marketing bench.",
    description:
      "Brief the workstreams. We source marketers who execute against your brand and calendar, with salary managed by Beepa.",
    hook: "Content, campaigns, and channels.",
    shortLabel: "Marketing",
  },
  {
    slug: "elearning-course-dev",
    title: "eLearning Course Development",
    summary:
      "Instructional designers and course builders for modules your L&D team owns.",
    description:
      "We place eLearning talent who can structure content, build in your LMS, and ship on your schedule. Employment stays with Beepa.",
    hook: "Modules built for your LMS.",
    shortLabel: "eLearning development",
  },
  {
    slug: "slide-creator",
    title: "Slide Creator",
    summary:
      "Presentation specialists who turn briefs into clear, on-brand decks.",
    description:
      "Need slides for pitches, training, or leadership reviews? We find creators who match your templates and turnaround, then manage their pay.",
    hook: "Decks from brief to delivery.",
    shortLabel: "Slide creator",
  },
  {
    slug: "data-entry",
    title: "Data Entry",
    summary:
      "Accurate, high-volume data work without adding permanent headcount.",
    description:
      "We place data entry professionals who follow your systems and QA rules. You own the data; we own staffing and salary.",
    hook: "Volume work with clear QA.",
    shortLabel: "Data entry",
  },
  {
    slug: "customer-relations",
    title: "Customer Relations",
    summary:
      "Account and relationship talent who nurture clients after the first contact.",
    description:
      "Distinct from frontline support: we place people focused on retention, follow-ups, and relationship health. You set the playbook; we place and pay the team.",
    hook: "Retention and relationship follow-through.",
    shortLabel: "Customer relations",
  },
] as const satisfies ReadonlyArray<ServiceCatalogItem>;

export const SERVICES_CATALOG_SLUGS = new Set<string>(
  SERVICES_CATALOG.map((item) => item.slug),
);

export type CmsServiceRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
};

/** Catalog first (principal order); CMS overrides matching slugs; extras append. */
export function resolveMarketingServices(
  cms: CmsServiceRow[] | null | undefined,
): Array<{
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
}> {
  const bySlug = new Map((cms ?? []).map((row) => [row.slug, row]));

  const fromCatalog = SERVICES_CATALOG.map((item) => {
    const row = bySlug.get(item.slug);
    if (row) {
      return {
        id: row.id,
        slug: row.slug,
        title: row.title || item.title,
        summary: row.summary?.trim() || item.summary,
        description: row.description?.trim() || item.description,
      };
    }
    return {
      id: `fallback-${item.slug}`,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      description: item.description,
    };
  });

  const extras = (cms ?? [])
    .filter((row) => !SERVICES_CATALOG_SLUGS.has(row.slug))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? "",
      description: row.description ?? "",
    }));

  return [...fromCatalog, ...extras];
}
