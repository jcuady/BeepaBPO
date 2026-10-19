import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconBriefcase,
  IconHeartHandshake,
  IconPlant2,
  IconSearch,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectCompact } from "@/components/ui/native-select";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";
import { BreadcrumbJsonLd } from "@/components/marketing/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Open roles at Beepa BPO. Search current openings and filter by employment type, work setup and location, then apply with a free applicant account.",
  // Filtered variants (?q=, ?type= …) are the same page. They stay crawlable so a
  // shared link works, but canonical points at the unfiltered list so the
  // variants cannot fragment the ranking signal across hundreds of URLs.
  alternates: { canonical: "/careers" },
};

/** Filter values, in the order they are offered. Mirrors the DB enums. */
const EMPLOYMENT_TYPES = [
  { value: "regular", label: "Full-time" },
  { value: "contractual", label: "Contractual" },
  { value: "part_time", label: "Part-time" },
  { value: "probationary", label: "Probationary" },
  { value: "intern", label: "Internship" },
] as const;

const LOCATION_TYPES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

const CULTURE = [
  {
    title: "Growth that sticks",
    line: "Clear roles, real coaching, and room to take on more responsibility.",
    icon: IconPlant2,
  },
  {
    title: "People over polish",
    line: "We hire for character and teach the craft — attitude first.",
    icon: IconUsersGroup,
  },
  {
    title: "Paid with respect",
    line: "On-time pay and honest communication are non-negotiable.",
    icon: IconHeartHandshake,
  },
] as const;

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

/** Read one query value, ignoring empty strings and junk from a hand-edited URL. */
function readParam(
  params: URLSearchParams,
  key: string,
  allowed?: readonly string[],
): string | null {
  const raw = params.get(key);
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  // An unrecognised value would silently widen the result set rather than
  // narrow it, so a stale link shows everything instead of quietly lying.
  if (allowed && !allowed.includes(value)) return null;
  return value;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CareersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    const value = one(v);
    if (value) sp.set(k, value);
  }

  const q = sp.get("q")?.trim().slice(0, 80) ?? "";
  const employmentType = readParam(
    sp,
    "type",
    EMPLOYMENT_TYPES.map((t) => t.value),
  );
  const locationType = readParam(
    sp,
    "setup",
    LOCATION_TYPES.map((t) => t.value),
  );

  const supabase = await createClient();

  const { data: allJobs } = await supabase
    .from("job_posts")
    .select(
      "id, title, slug, location_text, location_type, employment_type, salary_display, description, published_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const jobs = allJobs ?? [];

  /*
    Location options are derived from the published roles themselves rather than
    from a lookup table. `job_posts.department_id` points at `departments`,
    which is deliberately NOT readable by an anonymous visitor -- its RLS policy
    is `to authenticated` using `is_internal_user() or employees.read`, and the
    migration labels it "Departments / teams (internal HR)". Probing both keys
    confirmed it: 5 rows with the service key, 0 with the anon key the careers
    page actually uses.

    So a "Team" dropdown built on `departments` would have rendered a control
    with a single "All teams" option and no explanation. Everything below is
    sourced from `job_posts`, which anon CAN read, so every filter has real
    options. Publishing internal HR structure to make a filter work is not a
    change worth making silently.
  */
  const locations = [...new Set(jobs.map((j) => j.location_text).filter((v): v is string => !!v && !!v.trim()))].sort(
    (a, b) => a.localeCompare(b),
  );

  const locationText = sp.get("location")?.trim().slice(0, 80) ?? "";
  const needle = q.toLowerCase();
  const filtered = jobs.filter((job) => {
    if (employmentType && job.employment_type !== employmentType) return false;
    if (locationType && job.location_type !== locationType) return false;
    if (locationText && (job.location_text ?? "") !== locationText) return false;
    if (!needle) return true;
    // Title, description and location — the three things someone actually types
    // when hunting a role. Every whitespace-separated term must match, so
    // "customer support" narrows rather than widens.
    const haystack = [job.title, job.description, job.location_text ?? ""]
      .join(" ")
      .toLowerCase();
    return needle.split(/\s+/).every((term) => haystack.includes(term));
  });

  const filtersOn =
    Boolean(q) ||
    Boolean(employmentType) ||
    Boolean(locationType) ||
    Boolean(locationText);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Careers", path: "/careers" },
        ]}
      />
      <PageHero
        eyebrow="Careers"
        title="Build your career with people who value your growth."
        description={
          <>
            Join {BRAND.displayName} — we place talent with companies and take
            care of the people behind every role. Search the openings below, then
            create a free applicant account to apply in one step.
          </>
        }
        cta={
          jobs.length
            ? { href: "#open-roles", label: "See open roles" }
            : { href: "/contact", label: "Get in touch" }
        }
        // `next` so an applicant who creates an account from here lands back on
        // the list they were reading instead of a generic dashboard.
        secondaryCta={{ href: "/signup?next=/careers", label: "Create account" }}
      />

      <section className="bg-white py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-5">
              <SectionHeading as="h2">Life at Beepa</SectionHeading>
              <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-slate">
                A manpower culture built on clear work, fair pay, and teams that
                look out for each other.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-7">
              {CULTURE.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="border-t border-line pt-5">
                    <Icon
                      stroke={1.5}
                      className="size-6 text-green-strong"
                      aria-hidden
                    />
                    <h3 className="mt-3 font-display text-base font-semibold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-base leading-relaxed text-slate">
                      {item.line}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      <section
        id="open-roles"
        className="scroll-mt-24 border-t border-line bg-mist/40 py-20 md:py-28"
      >
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <SectionHeading as="h2">Open roles</SectionHeading>
              <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-slate">
                {jobs.length
                  ? "Filter by employment type, work setup or location, then apply with your Beepa account."
                  : "No open roles right now — leave a note and we will reach out when something fits."}
              </p>
            </div>
            <p className="font-display text-sm text-slate lg:col-span-5 lg:justify-self-end lg:text-right">
              {filtersOn ? (
                <>
                  <span className="text-navy">{filtered.length}</span> of {jobs.length} open{" "}
                  {jobs.length === 1 ? "role" : "roles"}
                </>
              ) : (
                <>
                  {jobs.length} open {jobs.length === 1 ? "role" : "roles"}
                </>
              )}
            </p>
          </div>

          {/*
            A plain GET form. No client state and no JS required: the filter is
            the URL, so it can be bookmarked, pasted into a job board, and
            crawled. A careers page that only filters in React is invisible to
            anyone without JavaScript and unshareable by link.
          */}
          {jobs.length > 0 ? (
            <form
              method="get"
              action="/careers"
              className="mt-10 rounded-none bg-white p-5 ring-1 ring-line md:p-6"
            >
              <div className="grid gap-4 md:grid-cols-12 md:items-end">
                <div className="md:col-span-4">
                  <label
                    htmlFor="careers-q"
                    className="flex flex-col gap-1 text-xs font-medium text-slate"
                  >
                    <span>Search roles</span>
                    <span className="relative">
                      <IconSearch
                        aria-hidden
                        stroke={1.75}
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate"
                      />
                      <Input
                        id="careers-q"
                        name="q"
                        type="search"
                        defaultValue={q}
                        placeholder="Title, keyword or location"
                        className="h-8 pl-9 [@media(pointer:coarse)]:h-11"
                      />
                    </span>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <NativeSelectCompact
                    id="careers-type"
                    name="type"
                    label="Employment"
                    defaultValue={employmentType ?? ""}
                  >
                    <option value="">Any type</option>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelectCompact>
                </div>

                <div className="md:col-span-2">
                  <NativeSelectCompact
                    id="careers-setup"
                    name="setup"
                    label="Work setup"
                    defaultValue={locationType ?? ""}
                  >
                    <option value="">Any setup</option>
                    {LOCATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelectCompact>
                </div>

                {locations.length > 0 ? (
                  <div className="md:col-span-2">
                    <NativeSelectCompact
                      id="careers-location"
                      name="location"
                      label="Location"
                      defaultValue={locationText}
                    >
                      <option value="">Any location</option>
                      {locations.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </NativeSelectCompact>
                  </div>
                ) : null}

                <div className="flex items-end gap-3 md:col-span-1">
                  <Button
                    type="submit"
                    nativeButton
                    className="min-h-8 w-full rounded-none bg-green-strong text-white [@media(pointer:coarse)]:min-h-11"
                  >
                    Filter
                  </Button>
                </div>
              </div>

              {filtersOn ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span className="text-xs font-medium text-slate">Filtered by:</span>
                  {q ? <FilterChip label={`“${q}”`} /> : null}
                  {employmentType ? (
                    <FilterChip
                      label={
                        EMPLOYMENT_TYPES.find((t) => t.value === employmentType)?.label ??
                        employmentType
                      }
                    />
                  ) : null}
                  {locationType ? (
                    <FilterChip
                      label={
                        LOCATION_TYPES.find((t) => t.value === locationType)?.label ??
                        locationType
                      }
                    />
                  ) : null}
                  {locationText ? <FilterChip label={locationText} /> : null}
                  <Link
                    href="/careers"
                    className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-green-strong hover:underline"
                  >
                    <IconX aria-hidden stroke={2} className="size-3.5" />
                    Clear all
                  </Link>
                </div>
              ) : null}
            </form>
          ) : null}

          {!jobs.length ? (
            <div className="mt-12 flex flex-col items-start gap-5 rounded-none bg-white p-8 ring-1 ring-line md:p-10">
              <span className="flex size-12 items-center justify-center rounded-none bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                <IconBriefcase stroke={1.5} className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-navy">
                  Nothing open at the moment
                </h3>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed text-slate">
                  We post roles as client demand opens up. Tell us what you do
                  well — we keep strong people in mind.
                </p>
              </div>
              <Button
                className="group min-h-11 gap-2 rounded-none bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
                nativeButton={false}
                render={<Link href="/contact" />}
              >
                Introduce yourself
                <span className="flex size-6 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                  <IconArrowRight stroke={2} className="size-3" aria-hidden />
                </span>
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            /*
              Distinct from "nothing open at all". Telling an applicant there are
              no jobs when there are four and their filter excluded them is the
              kind of message that loses the hire.
            */
            <div
              role="status"
              className="mt-12 flex flex-col items-start gap-5 rounded-none bg-white p-8 ring-1 ring-line md:p-10"
            >
              <span className="flex size-12 items-center justify-center rounded-none bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                <IconSearch stroke={1.5} className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-navy">
                  No roles match that search
                </h3>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed text-slate">
                  There {jobs.length === 1 ? "is 1 open role" : `are ${jobs.length} open roles`},
                  but none match the filters you picked. Clear them to see everything.
                </p>
              </div>
              <Link
                href="/careers"
                className="inline-flex min-h-11 items-center gap-2 rounded-none bg-green-strong px-5 text-sm font-medium text-white transition-colors hover:bg-green"
              >
                Clear filters
                <IconArrowRight stroke={2} className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className="mt-12 divide-y divide-line overflow-hidden rounded-none bg-white ring-1 ring-line">
              {filtered.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/careers/${job.slug}`}
                    className={cn(
                      "group flex flex-col gap-4 p-6 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7",
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist/60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-navy transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-green-strong">
                        {job.title}
                      </p>
                      <p className="mt-1 text-base text-slate">
                        {job.location_text ?? formatLabel(job.location_type)} ·{" "}
                        {formatLabel(job.employment_type)}
                        {job.salary_display ? ` · ${job.salary_display}` : ""}
                      </p>
                    </div>
                    <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-none bg-navy px-4 text-sm font-medium text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-green-strong active:scale-[0.97]">
                      View role
                      <IconArrowRight
                        stroke={2}
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/*
            The account step, on the page where the decision is made. Signing up
            from a role detail returns to that role; this is the entry point for
            someone browsing the list who has not picked one yet.
          */}
          {jobs.length > 0 ? (
            <div className="mt-12 flex flex-col gap-5 rounded-none bg-navy p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
              <div className="max-w-[52ch]">
                {/*
                  `text-white` is not decoration. `app/globals.css` applies
                  `text-navy` to every h1-h4, and an element rule beats
                  inheritance -- so on this navy panel the heading rendered
                  navy-on-navy at a contrast ratio of 1.0 and was invisible.
                  The contrast gate caught it, which is the gate earning its
                  keep.
                */}
                <h3 className="font-display text-xl font-bold text-white">
                  Applying for more than one role?
                </h3>
                <p className="mt-2 text-base leading-relaxed text-white/75">
                  Create one free applicant account. You keep your profile, track
                  every application, and hear back on all of them in one place.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button
                  nativeButton={false}
                  className="min-h-11 rounded-none bg-white px-5 text-navy hover:bg-mist"
                  render={<Link href="/signup?next=/careers" />}
                >
                  Create account
                </Button>
                {/*
                  The outline variant carries `bg-background`, which is the
                  off-white mist -- so on this navy panel the inherited
                  `text-white` landed on a near-white background at a ratio of
                  1.05 and the label was invisible. `bg-transparent` and
                  `hover:text-white` are here for the same reason `text-white`
                  is on the heading: the variant is built for a light surface.
                  `cn()` runs tailwind-merge, so these override the variant's
                  own background and hover colour.
                */}
                <Button
                  variant="outline"
                  nativeButton={false}
                  className="min-h-11 rounded-none border-white/40 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
                  render={<Link href="/login?next=/careers" />}
                >
                  Sign in
                </Button>
              </div>
            </div>
          ) : null}
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}

/** One active filter, shown in the "Filtered by" row. Decoration, not a control. */
function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-none bg-mist px-2.5 text-xs font-medium text-navy ring-1 ring-line">
      {label}
    </span>
  );
}
