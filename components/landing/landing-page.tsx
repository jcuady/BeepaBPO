"use client";

/**
 * The Beepa landing page.
 *
 * Ported from the reference in `BeepaBPO new landing design/src/routes/index.tsx`
 * (+ its `styles.css`, ported to `./landing.css` and scoped under
 * `.beepaLanding`). The reference is a standalone Vite + TanStack Router demo;
 * this is the same page inside the Next.js app.
 *
 * What changed in the port, and why:
 *
 *   - Routing. `createFileRoute` becomes a client component rendered by
 *     `app/page.tsx`, which is where the metadata now lives.
 *   - Assets. The reference imports its photos through a bundler asset pipeline.
 *     They are served from `/images/landing/*` and rendered with `next/image`.
 *   - `<Button asChild>`. The shared `Button` is a Base UI primitive with no
 *     `asChild`, so the one anchor that used it takes `buttonVariants()` as a
 *     class string. Same visual, no second button primitive.
 *   - The reference logo is remote-hosted; the repo's
 *     `/brand/beepa-logo-horizontal.png` is used instead.
 *
 * What did NOT change, deliberately:
 *
 *   - The planner, the FAQ accordion and the web/mobile preview are live state,
 *     exactly as in the reference.
 *
 * What did change after the port:
 *
 *   - The two dialogs no longer produce a client-side .txt draft. That WAS the
 *     reference's behaviour and was confirmed with the user when the reference
 *     was adopted as-is, but a download that says "Nothing is sent to Beepa" is
 *     not a lead funnel; both dialogs now post to the same server actions the
 *     /contact form uses. The planner configuration the dialog describes is NOT
 *     yet part of the stored lead — the actions read a fixed field list, so it
 *     would need a schema change. See the note on <LeadForm>.
 */

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  careerInquiryAction,
  contactAction,
} from "@/lib/contact/actions";
import type { ActionState } from "@/lib/auth/actions";
import { BRAND } from "@/lib/site";
import { faqs, services } from "./content";
import { AssuranceStrip } from "@/components/marketing/assurance-strip";
import { MediaHero } from "@/components/marketing/media-hero";
import "@/components/marketing/editorial.css";
import "./landing.css";

const specialist = "/images/landing/beepa-specialist.jpg";
const team = "/images/landing/beepa-team.jpg";
const collaboration = "/images/landing/beepa-collaboration.jpg";
const logo = "/brand/beepa-logo-horizontal.png";

/** Links the dialog's footer button to the form above it — see the footer. */
const DIALOG_FORM_ID = "landing-lead-form";

/** `ok: false` with no message is "nothing submitted yet", not "failed". */
const INITIAL_ACTION_STATE: ActionState = { ok: false };

function Arrow() {
  return (
    <span className="mh-arrow" aria-hidden="true">
      ↗
    </span>
  );
}

/**
 * The body and footer of both lead dialogs.
 *
 * It owns `useActionState` itself, and that placement is the point. Base UI's
 * `Dialog.Portal` unmounts its subtree when the dialog closes, so this
 * component's action state is discarded on close and every open starts clean —
 * no reset helper, no "has this already succeeded" flag that has to be cleared
 * by hand on every entry point that can open the dialog.
 *
 * It also removes the two `useEffect`s this used to need. Those read
 *
 *     if (teamSucceeded) setModal(null);
 *
 * under a comment promising the confirmation is "never dismissed before the
 * reader has seen it". The code did the opposite: it closed the dialog in the
 * same commit that produced `state.ok`, so the success panel they were written
 * to protect was unmounted before it could be read. Deducing the confirmation
 * from state during render — and letting the reader dismiss it with their own
 * click — is both what the comment described and what
 * `react-hooks/set-state-in-effect` asks for.
 *
 * Everything here renders inside the dialog's PORTAL, so it sits outside
 * `.beepaLanding` and every `.beepaLanding .field` / `.dialog-form` /
 * `.hp` rule in landing.css cannot reach it. That is why this used to look
 * plain: the two-column field grid, the caption labels, the disclaimer and the
 * success panel were all CSS that structurally cannot apply here — and the
 * honeypot, scoped the same way, rendered as a visible empty input at the top
 * of the form. So it depends on no page-scoped class and styles itself from the
 * token layer alone.
 */
function LeadForm({
  kind,
  career,
  onDone,
}: {
  kind: "team" | "career";
  career: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    kind === "career" ? careerInquiryAction : contactAction,
    INITIAL_ACTION_STATE,
  );

  const done = state.ok === true;

  return (
    <>
      <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
        {done ? (
          <div
            role="status"
            className="mt-7 border border-primary/20 bg-accent px-4 py-4"
          >
            <p className="font-display text-base font-semibold text-foreground">
              {kind === "career" ? "Application brief received." : "Request received."}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate">
              {state.message ??
                "Thank you — we will be in touch shortly."}
            </p>
          </div>
        ) : (
          <form
            id={DIALOG_FORM_ID}
            className="mt-7 flex flex-col gap-5"
            action={action}
          >
            <input type="hidden" name="landing_page" value="/" />
            {kind === "career" && (
              <input type="hidden" name="career_area" value={career} />
            )}
            {/* Honeypot. Off-screen rather than `display: none`, because some
                bots skip hidden fields and this one is meant to be filled in.
                Inline classes, not `.hp` — see the portal note above. */}
            <div
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
              aria-hidden="true"
            >
              <Input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-label="Website"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="team-name"
                  className="block text-[13px] font-semibold text-navy"
                >
                  Your name
                </Label>
                <Input
                  id="team-name"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Full name"
                  aria-invalid={!!state.fieldErrors?.name}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="team-email"
                  className="block text-[13px] font-semibold text-navy"
                >
                  Email address
                </Label>
                <Input
                  id="team-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  aria-invalid={!!state.fieldErrors?.email}
                />
              </div>
            </div>

            {kind === "team" ? (
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="team-company"
                  className="block text-[13px] font-semibold text-navy"
                >
                  Company
                </Label>
                <Input
                  id="team-company"
                  name="company"
                  autoComplete="organization"
                  required
                  placeholder="Your business name"
                  aria-invalid={!!state.fieldErrors?.company}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="team-message"
                className="block text-[13px] font-semibold text-navy"
              >
                {kind === "career"
                  ? "Your experience & interests"
                  : "What would you like your team to take care of?"}
              </Label>
              <Textarea
                id="team-message"
                name="message"
                rows={3}
                required
                placeholder={
                  kind === "career"
                    ? "Tell us about your skills and experience."
                    : "A few words about your needs and goals."
                }
                aria-invalid={!!state.fieldErrors?.message}
              />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
              >
                {state.error}
              </p>
            ) : null}
          </form>
        )}
      </div>

      {/* A sibling of the form so it can sit on the dialog's own background
          strip. `form=` is what keeps the button wired to it — a
          `type="submit"` button outside its form submits nothing. */}
      <DialogFooter
        className={
          done
            ? "mx-0 mb-0 border-line bg-mist/60 px-6 py-5 sm:flex-row sm:items-center sm:px-8"
            : "mx-0 mb-0 flex-col gap-3 border-line bg-mist/60 px-6 py-5 sm:flex-row sm:items-center sm:px-8"
        }
      >
        {done ? (
          <Button
            variant="brand"
            className="w-full sm:w-auto"
            onClick={onDone}
          >
            Done
          </Button>
        ) : (
          <Button
            variant="brand"
            type="submit"
            form={DIALOG_FORM_ID}
            className="w-full sm:w-auto"
            disabled={pending}
          >
            {pending
              ? "Sending…"
              : `Send my ${kind === "career" ? "enquiry" : "request"}`}
          </Button>
        )}
        <p className="max-w-[34ch] text-[11px] leading-relaxed text-slate sm:text-right">
          {kind === "career"
            ? "This goes straight to our recruitment team. We will be in touch about opportunities that match your experience."
            : "This goes straight to our team. We will reply about roles, coverage and pricing for the plan above."}
        </p>
      </DialogFooter>
    </>
  );
}

import type { ProofCaseStudy, ProofPost } from "@/components/landing/content";

export default function LandingPage({
  proof,
}: {
  proof: { caseStudies: ProofCaseStudy[]; posts: ProofPost[] };
}) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"team" | "career" | null>(null);
  const [role, setRole] = useState("Customer Support");
  const [size, setSize] = useState(3);
  const [coverage, setCoverage] = useState("Your business hours");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [faq, setFaq] = useState<number | null>(0);
  const [career, setCareer] = useState("Customer Support");

  // Real submissions. The reference shipped a demo that downloaded a .txt draft
  // and said "Nothing is sent to Beepa". Both dialogs post to the same server
  // actions the /contact form uses, so a lead actually reaches the CRM. The
  // action state itself lives in <LeadForm> — see the note there for why it is
  // not held up here.

  const openTeam = (service?: string) => {
    if (service) setRole(service);
    setModal("team");
  };
  const openCareer = (value: string) => {
    setCareer(value);
    setModal("career");
  };

  return (
    <div className="beepaLanding">
      <div className="container">
        <header className="header">
          <Link href="/" aria-label={`${BRAND.name} home`}>
            <Image
              className="logo"
              src={logo}
              alt="Beepa Business Process Outsourcing"
              width={352}
              height={88}
              priority
            />
          </Link>
          <nav
            className={`nav ${menu ? "open" : ""}`}
            aria-label="Main navigation"
          >
            {[
              ["Services", "services"],
              ["Why Beepa", "why-beepa"],
              ["How it works", "how-it-works"],
              ["Transparency", "transparency"],
              ["Careers", "careers"],
            ].map(([label, id]) => (
              <a
                key={id}
                href={`#${id}`}
                className={id === "careers" ? "career-link" : ""}
                onClick={() => setMenu(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <Button
              variant="brand"
              className="header-cta"
              onClick={() => openTeam()}
            >
              Let&rsquo;s talk <Arrow />
            </Button>
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? "✕" : "☰"}
            </Button>
          </div>
        </header>

        <main>
          {/* ------------------------------------------------------------ hero */}
          {/*
            The hero is the shared `MediaHero`, the same component `/careers`
            renders. It used to be this page's own markup, with its rules
            scoped to `.beepaLanding` — which meant a second page could not
            have the same hero without a second copy of it. See
            `components/marketing/media-hero.tsx`.
          */}
          <MediaHero
            image={{
              src: specialist,
              alt: "Filipina support specialist wearing a Beepa uniform in a bright office",
            }}
            eyebrow="Filipino talent. Global ambition."
            title={
              <>
                Your people.
                <br />
                Your advantage.
                <br />
                <span>Your Beepa.</span>
              </>
            }
            description={
              <>
                Great businesses are built by great people.
                <br />
                We find, train, and manage your dedicated Filipino team. You
                focus on what comes next.
              </>
            }
            actions={
              <>
                <Button variant="brand" onClick={() => openTeam()}>
                  Build my team <Arrow />
                </Button>
                <a className={`${buttonVariants({ variant: "editorial" })} cta`} href="#services">
                  Explore our services <span className="mh-arrow">↓</span>
                </a>
              </>
            }
            topLabel="THE PEOPLE BEHIND YOUR PROGRESS"
            caption={{
              title: "A little closer to your team.",
              subtitle: "Even from a world away.",
              location: ["BASED IN THE PHILIPPINES", "Connected to your business."],
            }}
            foot={
              <>
                <Image
                  className="mini-portrait"
                  src={specialist}
                  alt="Filipina support specialist"
                  width={64}
                  height={64}
                  data-round-shape="person"
                />
                <div>
                  <strong>Real people. Fully in your corner.</strong>
                  Dedicated to your business, not just your tasks.
                </div>
              </>
            }
            priority
          />

          <AssuranceStrip
            items={[
              "Dedicated Filipino talent",
              "Your hours. Your workflows.",
              "Web & mobile visibility",
              "Transparent payroll & performance",
            ]}
          />

          {/* --------------------------------------------------------- 01 why */}
          <section className="ed-section" id="why-beepa">
            <span className="ed-number">01 / MORE THAN OUTSOURCING</span>
            <h2 className="ed-headline">
              Beepa finds{" "}
              <Image
                className="inline-face"
                src={specialist}
                alt=""
                width={90}
                height={64}
              />{" "}
              trains{" "}
              <Image
                className="inline-face"
                src={collaboration}
                alt=""
                width={90}
                height={64}
              />{" "}
              and looks after
              <br className="hidden lg:block" /> the people who move your
              business forward.
              <br />
              <span className="muted">
                Your team. Your standards. A shared ambition.
              </span>
            </h2>
            <div className="ed-bottom">
              <p>
                From the first customer conversation to the work behind the
                scenes, we bring capable Filipino talent into your
                business&mdash;and make sure you never lose sight of the bigger
                picture.
              </p>
              <a className="ed-link" href="#how-it-works">
                Meet your next advantage <Arrow />
              </a>
            </div>
            <Image
              className="team-panorama"
              src={team}
              alt="A Filipino Beepa team collaborating and supporting customers in a modern office"
              width={2720}
              height={840}
              sizes="(max-width: 1360px) 100vw, 1232px"
            />
            <div className="ed-values">
              {(
                [
                  [
                    "People, not placements",
                    "A dedicated team that gets to know your brand, your customers, and how you work.",
                  ],
                  [
                    "Built around your business",
                    "The right roles, the right working hours, and a setup shaped around your needs.",
                  ],
                  [
                    "Supported from day one",
                    "Recruitment, onboarding, and ongoing team support. We stay in the picture.",
                  ],
                  [
                    "Nothing behind the curtain",
                    "Clear visibility into your people, payroll, attendance, and performance.",
                  ],
                ] as [string, string][]
              ).map(([title, desc]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <div
            className="greeting"
            aria-label="Hello from the Philippines"
          >
            <span>Hello.</span>
            <span>Kumusta.</span>
            <span>Your team is here.</span>
            <span>Let&rsquo;s grow.</span>
          </div>

          {/* ------------------------------------------------------ 02 services */}
          <section className="ed-section" id="services">
            <div className="section-heading">
              <div>
                <span className="ed-number">
                  02 / THE WORK WE TAKE OFF YOUR DESK
                </span>
                <h2>
                  More room for
                  <br />
                  what you do best.
                </h2>
              </div>
              <p>
                Ten specialisms. One committed partner. Start with the support
                you need today, and build the team your next chapter needs.
              </p>
            </div>
            <div className="service-grid">
              {(
                [
                  [
                    specialist,
                    "01",
                    "Customer Support",
                    "Every conversation matters. Give your customers a person who listens, understands, and follows through.",
                  ],
                  [
                    team,
                    "02",
                    "Back Office Support",
                    "The work behind the work. Organized, accurate, and taken care of.",
                  ],
                  [
                    collaboration,
                    "03",
                    "Virtual Assistants",
                    "Your trusted extra pair of hands. More focus, fewer loose ends.",
                  ],
                ] as [string, string, string, string][]
              ).map(([image, num, title, desc]) => (
                <article className="service-card" key={title}>
                  <Image
                    src={image}
                    alt={`${title} with Filipino Beepa professionals`}
                    fill
                    sizes="(max-width: 760px) 100vw, 40vw"
                  />
                  <div className="service-card-content">
                    <span className="service-counter">{num} /</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="service-list">
              {services.map((service, i) => (
                <div className="service-list-item" key={service}>
                  <Button variant="ghost" onClick={() => openTeam(service)}>
                    <div>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {service}
                    </div>
                    <span aria-hidden="true">↗</span>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------------------------------------------------- 03 time */}
          <section className="ed-section time-section">
            <div>
              <span className="ed-number">
                03 / A WORLD AWAY. RIGHT ON TIME.
              </span>
              <h2>
                Your business hours.
                <br />
                Our people, ready.
              </h2>
              <p>
                Across time zones and across your workflows, your Filipino team
                is built to show up when your business needs them.
              </p>
              <div className="time-list">
                {(
                  [
                    [
                      "Philippines",
                      "08:00",
                      "Where your dedicated team calls home",
                    ],
                    ["London", "01:00", "Connected across borders"],
                    ["New York", "20:00", "The previous evening"],
                    ["Sydney", "11:00", "The same working day"],
                  ] as [string, string, string][]
                ).map(([city, time, caption]) => (
                  <div className="time-row" key={city}>
                    <div>
                      <span>{city}</span>
                      <small>{caption}</small>
                    </div>
                    <strong>{time}</strong>
                  </div>
                ))}
              </div>
              <p>
                Illustrative time-zone comparison · October, daylight saving
                observed.
              </p>
            </div>
            <Image
              className="time-photo"
              src={team}
              alt="Beepa professionals working by a window overlooking the Philippines"
              width={1360}
              height={1600}
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </section>

          {/* ------------------------------------------------------- 04 process */}
          <section className="ed-section" id="how-it-works">
            <div className="section-heading">
              <div>
                <span className="ed-number">
                  04 / A CLEAR PATH TO YOUR TEAM
                </span>
                <h2>
                  From a first conversation
                  <br />
                  to a team that clicks.
                </h2>
              </div>
              <p>
                No handoffs into the unknown. We work with you at every step, so
                your people are ready for your business&mdash;not just the job
                description.
              </p>
            </div>
            <div className="process-grid">
              {(
                [
                  [
                    "01 / ALIGN",
                    "Let’s get to know your business.",
                    "We map your goals, roles, workflows, and coverage. The starting point is always you.",
                    collaboration,
                  ],
                  [
                    "02 / FIND",
                    "The right people. Not just a résumé.",
                    "We identify Filipino talent suited to the skills, working style, and standards you need.",
                    specialist,
                  ],
                  [
                    "03 / PREPARE",
                    "Your brand becomes second nature.",
                    "Onboarding and training connect your team to your tools, processes, and customers.",
                    team,
                  ],
                  [
                    "04 / GROW",
                    "Go live. Stay connected.",
                    "Ongoing support, performance reviews, and clear reporting keep your team moving forward.",
                    collaboration,
                  ],
                ] as [string, string, string, string][]
              ).map(([step, title, desc, image]) => (
                <article className="process-step" key={step}>
                  <div className="process-step-copy">
                    <span>{step}</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                  <Image
                    src={image}
                    alt={title}
                    width={1200}
                    height={900}
                    sizes="(max-width: 760px) 50vw, 25vw"
                  />
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* --------------------------------------------------- 05 transparency */}
      <section className="transparency-band" id="transparency">
        <div className="container ed-section transparency">
          <div className="section-heading">
            <div>
              <span className="ed-number">
                05 / FULL TRANSPARENCY. NO GUESSWORK.
              </span>
              <h2>
                Your team, in view.
                <br />
                Wherever you are.
              </h2>
            </div>
            <p>
              Outsourcing shouldn&rsquo;t mean being out of the loop. With access
              on web and mobile, your people, payroll, and progress stay within
              reach.
            </p>
          </div>
          <div className="platform-stage">
            <div className="platform-copy">
              <h3>
                A closer connection.
                <br />A clearer picture.
              </h3>
              <p>
                See the work. Understand the costs. Follow the progress. One
                shared view gives you more confidence in the team behind your
                business.
              </p>
              <div className="platform-items">
                {[
                  "Employee tracking & attendance",
                  "Payroll visibility & oversight",
                  "Overall team performance",
                  "Access on web & mobile",
                ].map((text) => (
                  <div className="platform-item" key={text}>
                    {text}
                    <span>✓</span>
                  </div>
                ))}
              </div>
              <div className="device-switch" aria-label="Platform preview">
                <Button
                  variant="ghost"
                  aria-pressed={device === "web"}
                  onClick={() => setDevice("web")}
                >
                  Web view
                </Button>
                <Button
                  variant="ghost"
                  aria-pressed={device === "mobile"}
                  onClick={() => setDevice("mobile")}
                >
                  Mobile view
                </Button>
              </div>
            </div>
            <div
              className={`dashboard ${device === "mobile" ? "mobile" : ""}`}
              aria-label={`${device} illustrative employee dashboard`}
              {...(device === "mobile"
                ? { "data-round-shape": "device-bezel" }
                : {})}
            >
              <div className="dashboard-top">
                <Image src={logo} alt="Beepa" width={170} height={40} />
                <span className="demo-label">ILLUSTRATIVE PREVIEW</span>
              </div>
              <h4>Your team, at a glance.</h4>
              <p className="dashboard-sub">
                Operations overview · This week
              </p>
              <div className="dashboard-stats">
                <div>
                  <small>Team members</small>
                  <strong>12</strong>
                </div>
                <div>
                  <small>Attendance</small>
                  <strong>
                    98<em>%</em>
                  </strong>
                </div>
                <div>
                  <small>Payroll</small>
                  <strong>Up to date</strong>
                </div>
              </div>
              <Table className="dashboard-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Team member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      ["A. Santos", "40h"],
                      ["M. Reyes", "40h"],
                      ["J. Garcia", "38h"],
                      ["R. Cruz", "40h"],
                    ] as [string, string][]
                  ).map(([name, hours]) => (
                    <TableRow key={name}>
                      <TableCell>{name}</TableCell>
                      <TableCell>
                        <span className="status">Active</span>
                      </TableCell>
                      <TableCell>{hours}</TableCell>
                      <TableCell>On track</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* ------------------------------------------------------- 06 report */}
        <section className="ed-section report-layout">
          <Image
            className="report-photo"
            src={collaboration}
            alt="Filipino team leaders reviewing work together"
            width={1200}
            height={1500}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <div className="report-copy">
            <span className="ed-number">06 / PROGRESS YOU CAN SEE</span>
            <h2>
              Less chasing updates.
              <br />
              More moving forward.
            </h2>
            <p>
              Know what&rsquo;s happening, what&rsquo;s working, and where your
              team needs support. Clear reporting turns day-to-day activity into
              meaningful conversations.
            </p>
            <div className="report-list">
              {(
                [
                  ["Employee attendance", "Visible"],
                  ["Payroll & team costs", "Transparent"],
                  ["Goals & performance", "Trackable"],
                  ["Your next decision", "Better informed"],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="promise">
          {(
            [
              [
                "Dedicated.",
                "A team that feels like yours.",
                "People who learn your business, represent your brand, and become part of your everyday.",
              ],
              [
                "Connected.",
                "Distance without disconnect.",
                "Shared workflows and web and mobile access keep you close to the work and the people.",
              ],
              [
                "Accountable.",
                "A partnership with visibility.",
                "Clear expectations, transparent costs, and performance conversations grounded in the work.",
              ],
            ] as [string, string, string][]
          ).map(([word, title, desc]) => (
            <article key={word}>
              <strong>{word}</strong>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </section>

        {/* ------------------------------------------------------ 07 planner */}
        <section className="ed-section planner" id="team-plan">
          <div>
            <span className="ed-number">
              07 / YOUR NEXT CHAPTER STARTS HERE
            </span>
            <h2>
              A team built for you.
              <br />
              Not one size fits all.
            </h2>
            <p className="planner-description">
              Tell us where you need a little more capacity. Shape your starting
              team, and we&rsquo;ll help you plan the right next step.
            </p>
            <label className="field">
              <span>Where do you need support?</span>
              <NativeSelect
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {services.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </NativeSelect>
            </label>
            <label className="field">
              <div className="range-label">
                <span>How many people?</span>
                <strong>
                  {size} {size === 1 ? "person" : "people"}
                </strong>
              </div>
              <input
                aria-label="Team size"
                type="range"
                min={1}
                max={20}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>When do you need your team?</span>
              <NativeSelect
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
              >
                <option>Your business hours</option>
                <option>Extended hours</option>
                <option>Round-the-clock coverage</option>
              </NativeSelect>
            </label>
          </div>
          <div className="planner-summary">
            <span className="summary-title">YOUR STARTING TEAM</span>
            <h3>
              <span>
                {size} dedicated {size === 1 ? "person" : "people"}.
              </span>
              <br />A world of possibility.
            </h3>
            <div className="summary-details">
              {(
                [
                  ["Specialism", role],
                  ["Coverage", coverage],
                  ["Location", "Philippines"],
                  ["Client access", "Web & mobile"],
                  ["Pricing", "Tailored to your team"],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <Button variant="brand" onClick={() => openTeam()}>
              Let&rsquo;s plan my team <Arrow />
            </Button>
            <p>
              No commitment. Just a conversation about the people, scope, and
              support your business needs.
            </p>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------- 08 careers */}
      <section className="careers-band" id="careers">
        <div className="container careers">
          <div>
            <span className="ed-number">
              08 / GREAT PEOPLE. MEANINGFUL WORK.
            </span>
            <h2>
              Your talent deserves
              <br />a bigger stage.
            </h2>
            <p>
              Bring your skills, your curiosity, and your ambition. Discover a
              career connecting Filipino talent with businesses around the
              world.
            </p>
            <div className="career-ctas">
              <Button
                variant="inverse"
                onClick={() => openCareer("General interest")}
              >
                Explore a career with Beepa <Arrow />
              </Button>
              {/* Every other control in this section opens the lead dialog, so
                  a candidate who wanted an actual vacancy had no way to reach
                  one: /careers holds the live roles with location, type and
                  salary, and nothing on the homepage linked to it. The note
                  below already admits these are career areas rather than a
                  vacancy list — which is exactly why the escape hatch has to
                  be right there. */}
              <Link href="/careers" className="career-list-link">
                See all open roles <Arrow />
              </Link>
            </div>
          </div>
          <div>
            {[
              "Customer Support",
              "Operations & Virtual Assistance",
              "Sales, IT & Creative",
            ].map((area) => (
              <div className="career-row" key={area}>
                <div>
                  <h3>{area}</h3>
                  <small>Philippines · Explore this career area</small>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Prepare application for ${area}`}
                  onClick={() => openCareer(area)}
                >
                  <Arrow />
                </Button>
              </div>
            ))}
            <div className="career-note">
              Career areas shown, not a live vacancy list. Availability to be
              confirmed.
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* --------------------------------------------------------- 09 faq */}
        <section className="ed-section faq-layout" id="questions">
          <div>
            <span className="ed-number">09 / BEFORE WE SAY HELLO</span>
            <h2>
              Good questions.
              <br />
              Straight answers.
            </h2>
            <p>
              A little clarity goes a long way. Here&rsquo;s what you might want
              to know before building your team.
            </p>
          </div>
          <div>
            {faqs.map(([q, a], i) => (
              <div className="faq-item" key={q}>
                <Button
                  variant="ghost"
                  type="button"
                  aria-expanded={faq === i}
                  aria-controls={`answer-${i}`}
                  onClick={() => setFaq(faq === i ? null : i)}
                >
                  <span>{q}</span>
                  <span>{faq === i ? "−" : "+"}</span>
                </Button>
                {faq === i && <p id={`answer-${i}`}>{a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------- 10 proof */}
        {/* Sits after the FAQ and before the closing CTA: the reader has just
            finished the argument, and this is the moment they want evidence
            rather than more persuasion.

            The brandbook forbids fabricated client logos, testimonials, metrics
            and awards — five documents in this repo repeat it, including
            "do not show 'trusted by' fake companies" and "use a neutral proof
            statement or omit the logo strip". So this section shows no logos,
            quotes or invented numbers. It links to work that has actually been
            published, which is both honest and more persuasive than a logo wall
            nobody can check.

            Renders nothing when nothing is published. An empty "proof" section
            would be worse than none. */}
        {proof.caseStudies.length + proof.posts.length > 0 ? (
          <section className="ed-section proof" id="proof">
            <span className="ed-number">10 / PROOF, NOT PROMISES</span>
            <div className="section-heading">
              <h2>Work you can go and check.</h2>
              <p>
                We would rather point you at the detail than ask you to take our
                word for it. Real engagements, written up properly — including
                the parts we would do differently next time.
              </p>
            </div>

            <div className="proof-grid">
              {proof.caseStudies.map((study) => (
                <Link
                  key={`cs-${study.slug}`}
                  href={`/case-studies/${study.slug}`}
                  className="proof-card"
                >
                  <span className="proof-kind">Case study</span>
                  <h3>{study.title}</h3>
                  {study.summary ? <p>{study.summary}</p> : null}
                  {[study.client_name, study.industry]
                    .filter(Boolean)
                    .join(" · ") ? (
                    <span className="proof-meta">
                      {[study.client_name, study.industry]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Link>
              ))}

              {proof.posts.map((post) => (
                <Link
                  key={`rp-${post.slug}`}
                  href={`/resources/${post.slug}`}
                  className="proof-card"
                >
                  <span className="proof-kind">Resource</span>
                  <h3>{post.title}</h3>
                  {post.excerpt ? <p>{post.excerpt}</p> : null}
                </Link>
              ))}
            </div>

            <Link href="/case-studies" className="proof-more ed-link">
              Every case study and resource <Arrow />
            </Link>
          </section>
        ) : null}

        {/* ------------------------------------------------------ final cta */}
        <section className="final-cta">
          <Image
            src={team}
            alt="Your next Filipino team at Beepa"
            fill
            sizes="100vw"
          />
          <div className="final-copy">
            <h2>
              Your next great hire.
              <br />
              Your next big move.
            </h2>
            <p>Let&rsquo;s build the team that takes you there.</p>
            <Button variant="inverse" onClick={() => openTeam()}>
              Build my team <Arrow />
            </Button>
          </div>
        </section>

        {/* -------------------------------------------------------- footer */}
        <footer className="footer">
          <div className="footer-top">
            <div>
              <Image
                className="logo"
                src={logo}
                alt="Beepa Business Process Outsourcing"
                width={352}
                height={88}
              />
              <p className="footer-tagline">
                Filipino talent. A shared ambition.
              </p>
            </div>
            <div className="footer-links">
              <div>
                <strong>YOUR BUSINESS</strong>
                <a href="#services">Our services</a>
                <a href="#how-it-works">How it works</a>
                <a href="#transparency">Full transparency</a>
                <a href="#team-plan">Build your team</a>
              </div>
              <div>
                <strong>OUR PEOPLE</strong>
                <a href="#why-beepa">Why Beepa</a>
                <a href="#careers">Careers</a>
                <a href="#questions">Questions &amp; answers</a>
              </div>
              {/* These routes existed and were in the sitemap, but the landing
                  page — the highest-authority page on the site — linked to
                  none of them. Every other marketing page gets them from the
                  shared `SiteFooter`; this page renders the reference design's
                  own footer, which only ever pointed at on-page anchors. That
                  left /case-studies, /resources and /about reachable only from
                  each other, and left /privacy and /terms unreachable from the
                  homepage entirely. */}
              <div>
                <strong>PROOF &amp; COMPANY</strong>
                <Link href="/case-studies">Case studies</Link>
                <Link href="/resources">Resources</Link>
                <Link href="/why-beepa">About Beepa</Link>
                <Link href="/services">All services</Link>
              </div>
              {/* Two buyer questions the landing page could not answer and that
                  had no destination anywhere on the site. Both are now real
                  pages, so the links are real. */}
              <div>
                <strong>WORKING TOGETHER</strong>
                <Link href="/pricing">Pricing</Link>
                <Link href="/security">Security</Link>
                <Link href="/contact">Request a team</Link>
                <Link href="/case-studies">See the outcomes</Link>
              </div>
              <div>
                <strong>LEGAL</strong>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/login">Client sign in</Link>
                <Link href="/employee/login">Employee sign in</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Beepa BPO. All rights reserved.
            </span>
            <span>Based in the Philippines. Built for your world.</span>
          </div>
          <div
            className="footer-brand"
            aria-hidden="true"
            data-round-shape="brand-mark"
          >
            <span />BEEPA.
          </div>
        </footer>
      </div>

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
            <DialogHeader className="gap-2.5">
              <span className="font-display text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
                {modal === "career" ? "Careers" : "Get started"}
              </span>
              <DialogTitle className="font-display text-2xl leading-tight font-semibold text-ink sm:text-[28px]">
                {modal === "career" ? "Your next chapter with Beepa." : "Let’s shape your team."}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-slate">
                {modal === "career"
                  ? `Prepare your application brief for ${career}.`
                  : `${size} ${size === 1 ? "person" : "people"} · ${role} · ${coverage}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          {modal !== null ? (
            <LeadForm
              key={modal}
              kind={modal}
              career={career}
              onDone={() => setModal(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
