import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { AssuranceStrip } from "@/components/marketing/assurance-strip";
import { FinalCTA } from "@/components/marketing/final-cta";
import { MediaHero } from "@/components/marketing/media-hero";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectCompact } from "@/components/ui/native-select";
import { BreadcrumbJsonLd } from "@/components/marketing/breadcrumb-json-ld";
import "@/components/marketing/editorial.css";
import "./careers.css";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Open roles at Beepa BPO. Search current openings and filter by employment type, work setup and location, then apply with a free applicant account.",
  // Filtered variants (?q=, ?type= …) are the same page. They stay crawlable so a
  // shared link works, but canonical points at the unfiltered list so the
  // variants cannot fragment the ranking signal across hundreds of URLs.
  alternates: { canonical: "/careers" },
};

/** The careers hero photograph — people in Beepa uniforms. Generated, branded. */
const HERO = "/images/landing/careers-hero.webp";
/** The same person, cut square, for the hero's foot strip. */
const HERO_PORTRAIT = "/images/landing/careers-portrait.jpg";

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

      {/*
        The same hero the landing page renders — the same component, the same
        grid, the same type scale, the same badge-and-caption treatment over
        the photograph. There is one hero, so the two pages cannot drift.
      */}
      <Container>
        <MediaHero
          image={{
            src: HERO,
            alt: "Filipina support specialist wearing a Beepa uniform in a bright office",
          }}
          eyebrow="Careers at Beepa"
          title={
            <>
              Your craft.
              <br />
              Your growth.
              <br />
              <span>Your Beepa.</span>
            </>
          }
          description={
            <>
              We staff the teams that keep businesses moving, and we look after
              our own people the same way: clear work, fair pay, real coaching.
            </>
          }
          actions={
            <>
              <Button
                variant="brand"
                nativeButton={false}
                render={<Link href="#open-roles" />}
              >
                See open roles
                <span className="mh-arrow" aria-hidden="true">
                  ↗
                </span>
              </Button>
              <a
                className={`${buttonVariants({ variant: "editorial" })} cta`}
                href="/signup?next=/careers"
              >
                Create account
                <span className="mh-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </>
          }
          topLabel="THE PEOPLE BEHIND THE PROGRESS"
          caption={{
            title: "A team that has your back.",
            subtitle: "Real work, real coaching, real progression.",
            location: ["BASED IN THE PHILIPPINES", "GROWING WITH EVERY ROLE"],
          }}
          foot={
            <>
              <Image
                className="mini-portrait"
                src={HERO_PORTRAIT}
                alt="Beepa team member"
                width={64}
                height={64}
                data-round-shape="person"
              />
              <div>
                <strong>One profile. Every application.</strong>
                Create a free account and we will track every role you apply for.
              </div>
            </>
          }
          priority
        />

        <AssuranceStrip
          items={[
            "Real roles, posted openly",
            "One profile, every application",
            "Clear pay, paid on time",
            "Coaching from day one",
          ]}
        />
      </Container>

      <Container>
        <section className="ed-section" id="life-at-beepa">
          <span className="ed-number">01 / LIFE AT BEEPA</span>
          <h2 className="ed-headline">
            A manpower culture built on clear work, fair pay, and teams that
            look out for each other.
          </h2>
          <div className="ed-bottom">
            <p>
              We hire for character and teach the craft. Attitude first, then the
              skills — with coaching, honest feedback, and a path to more
              responsibility as you grow.
            </p>
            <a className="ed-link" href="#open-roles">
              See open roles
              <span className="mh-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>

          <ul
            className="ed-values"
            style={{ "--ed-value-cols": 3 } as CSSProperties}
          >
            {CULTURE.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <Icon stroke={1.5} className="size-6 text-green-strong" aria-hidden />
                  <h3 className="mt-3">{item.title}</h3>
                  <p className="mt-1.5">{item.line}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </Container>

      <Container>
        <section className="ed-section" id="open-roles">
          <span className="ed-number">02 / OPEN ROLES</span>
          <h2 className="ed-headline">Every role we have open, in one list.</h2>
          <div className="ed-bottom">
            <p>
              {jobs.length
                ? "Filter by employment type, work setup or location, then apply with your Beepa account."
                : "No open roles right now — leave a note and we will reach out when something fits."}
            </p>
            <p className="font-display text-sm text-slate lg:justify-self-end lg:text-right">
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
            <form method="get" action="/careers" className="cr-filters">
              <div className="grid gap-4 md:grid-cols-6 md:items-end">
                <div className="md:col-span-2">
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

                <div className="md:col-span-1">
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

                <div className="md:col-span-1">
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
                  <div className="md:col-span-1">
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
                <div className="cr-chips">
                  <span className="cr-chip-label">Filtered by:</span>
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
                  <Link href="/careers" className="cr-chip-clear">
                    <IconX aria-hidden stroke={2} className="size-3.5" />
                    Clear all
                  </Link>
                </div>
              ) : null}
            </form>
          ) : null}

          {!jobs.length ? (
            <div className="cr-empty">
              <span className="cr-empty-icon">
                <IconBriefcase stroke={1.5} className="size-6" aria-hidden />
              </span>
              <div>
                <h3>Nothing open at the moment</h3>
                <p>
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
            <div role="status" className="cr-empty">
              <span className="cr-empty-icon">
                <IconSearch stroke={1.5} className="size-6" aria-hidden />
              </span>
              <div>
                <h3>No roles match that search</h3>
                <p>
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
            <ul className="cr-list">
              {filtered.map((job) => (
                <li key={job.id}>
                  <Link href={`/careers/${job.slug}`} className="cr-row group">
                    <div className="min-w-0">
                      <p className="cr-row-title font-display">{job.title}</p>
                      <p className="cr-row-meta">
                        {job.location_text ?? formatLabel(job.location_type)} ·{" "}
                        {formatLabel(job.employment_type)}
                        {job.salary_display ? ` · ${job.salary_display}` : ""}
                      </p>
                    </div>
                    <span className="cr-go">
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
        </section>
      </Container>

      {/*
        The account step, on the page where the decision is made. Signing up
        from a role detail returns to that role; this is the entry point for
        someone browsing the list who has not picked one yet.
      */}
      <section className="cr-band">
        <Container>
          <div className="cr-band-inner">
            <div>
              <h2>Applying for more than one role?</h2>
              {/*
                `text-white` is not decoration. `app/globals.css` applies
                `text-navy` to every h1-h4, and an element rule beats
                inheritance -- so on this navy panel the heading rendered
                navy-on-navy at a contrast ratio of 1.0 and was invisible.
                The contrast gate caught it, which is the gate earning its
                keep.
              */}
              <p>
                Create one free applicant account. You keep your profile, track
                every application, and hear back on all of them in one place.
              </p>
            </div>
            <div className="cr-band-actions">
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
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}

/** One active filter, shown in the "Filtered by" row. Decoration, not a control. */
function FilterChip({ label }: { label: string }) {
  return <span className="cr-chip">{label}</span>;
}
