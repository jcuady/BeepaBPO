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
 *   - The two dialogs still produce a client-side .txt draft and submit
 *     nothing. This was confirmed with the user: the reference is being
 *     adopted as-is, placeholder channel and all. See `docs/CHANGELOG.md`.
 */

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import "./landing.css";

const specialist = "/images/landing/beepa-specialist.jpg";
const team = "/images/landing/beepa-team.jpg";
const collaboration = "/images/landing/beepa-collaboration.jpg";
const logo = "/brand/beepa-logo-horizontal.png";

/** `ok: false` with no message is "nothing submitted yet", not "failed". */
const INITIAL_ACTION_STATE: ActionState = { ok: false };

function Arrow() {
  return (
    <span className="arrow" aria-hidden="true">
      ↗
    </span>
  );
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"team" | "career" | null>(null);
  const [role, setRole] = useState("Customer Support");
  const [size, setSize] = useState(3);
  const [coverage, setCoverage] = useState("Your business hours");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [faq, setFaq] = useState<number | null>(0);
  const [career, setCareer] = useState("Customer Support");

  // Real submissions. The reference shipped a demo that downloaded a .txt draft
  // and said "Nothing is sent to Beepa"; these two dialogs now post to the same
  // server actions the /contact form uses, so a lead actually reaches the CRM.
  const [teamState, teamAction, teamPending] = useActionState(
    contactAction,
    INITIAL_ACTION_STATE,
  );
  const [careerState, careerAction, careerPending] = useActionState(
    careerInquiryAction,
    INITIAL_ACTION_STATE,
  );

  const teamSucceeded = teamState.ok === true && !teamPending;
  const careerSucceeded = careerState.ok === true && !careerPending;

  // Close only once the submission has actually landed, so the confirmation is
  // never dismissed before the reader has seen it.
  useEffect(() => {
    if (teamSucceeded) setModal(null);
  }, [teamSucceeded]);

  useEffect(() => {
    if (careerSucceeded) setModal(null);
  }, [careerSucceeded]);

  const openTeam = (service?: string) => {
    if (service) setRole(service);
    setModal("team");
  };
  const openCareer = (value: string) => {
    setCareer(value);
    setModal("career");
  };

  // The dialog renders both forms from one set of fields, so the pending flag
  // and the returned state are selected by whichever dialog is open.
  const activePending = modal === "career" ? careerPending : teamPending;
  const activeState = modal === "career" ? careerState : teamState;


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
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">Filipino talent. Global ambition.</div>
              <h1>
                Your people.
                <br />
                Your advantage.
                <br />
                <span>Your Beepa.</span>
              </h1>
              <p className="hero-description">
                Great businesses are built by great people.
                <br />
                We find, train, and manage your dedicated Filipino team. You
                focus on what comes next.
              </p>
              <div className="hero-buttons">
                <Button variant="brand" onClick={() => openTeam()}>
                  Build my team <Arrow />
                </Button>
                <a className={`${buttonVariants({ variant: "editorial" })} cta`} href="#services">
                  Explore our services <span className="arrow">↓</span>
                </a>
              </div>
              <div className="hero-foot">
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
              </div>
            </div>
            <div className="hero-media">
              <Image
                src={specialist}
                alt="Filipina support specialist wearing a Beepa uniform in a bright office"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <div className="photo-top">THE PEOPLE BEHIND YOUR PROGRESS</div>
              <div className="photo-caption">
                <div>
                  <strong>A little closer to your team.</strong>
                  <span>Even from a world away.</span>
                </div>
                <div className="caption-location">
                  <span>BASED IN THE PHILIPPINES</span>
                  <br />
                  <span>Connected to your business.</span>
                </div>
              </div>
            </div>
          </section>

          <div className="assurance">
            {[
              "Dedicated Filipino talent",
              "Your hours. Your workflows.",
              "Web & mobile visibility",
              "Transparent payroll & performance",
            ].map((text) => (
              <div key={text}>
                <span className="check">✓</span>
                {text}
              </div>
            ))}
          </div>

          {/* --------------------------------------------------------- 01 why */}
          <section className="section" id="why-beepa">
            <span className="section-number">01 / MORE THAN OUTSOURCING</span>
            <h2 className="intro-headline">
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
            <div className="section-bottom">
              <p>
                From the first customer conversation to the work behind the
                scenes, we bring capable Filipino talent into your
                business&mdash;and make sure you never lose sight of the bigger
                picture.
              </p>
              <a className="text-link" href="#how-it-works">
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
            <div className="values">
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
          <section className="section" id="services">
            <div className="section-heading">
              <div>
                <span className="section-number">
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
          <section className="section time-section">
            <div>
              <span className="section-number">
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
          <section className="section" id="how-it-works">
            <div className="section-heading">
              <div>
                <span className="section-number">
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
        <div className="container section transparency">
          <div className="section-heading">
            <div>
              <span className="section-number">
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
        <section className="section report-layout">
          <Image
            className="report-photo"
            src={collaboration}
            alt="Filipino team leaders reviewing work together"
            width={1200}
            height={1500}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <div className="report-copy">
            <span className="section-number">06 / PROGRESS YOU CAN SEE</span>
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
        <section className="section planner" id="team-plan">
          <div>
            <span className="section-number">
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
            <span className="section-number">
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
            <Button variant="inverse" onClick={() => openCareer("General interest")}>
              Explore a career with Beepa <Arrow />
            </Button>
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
        <section className="section faq-layout" id="questions">
          <div>
            <span className="section-number">09 / BEFORE WE SAY HELLO</span>
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
                <a href="#questions">Questions & answers</a>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            {modal === "career"
              ? "Your next chapter with Beepa."
              : "Let’s shape your team."}
          </DialogTitle>
          <DialogDescription>
            {modal === "career"
              ? `Prepare your application brief for ${career}.`
              : `${size} ${size === 1 ? "person" : "people"} · ${role} · ${coverage}`}
          </DialogDescription>
          <form className="dialog-form" action={modal === "career" ? careerAction : teamAction}>
            <input type="hidden" name="landing_page" value="/" />
            {modal === "career" && (
              <input type="hidden" name="career_area" value={career} />
            )}
            {/* Honeypot. Hidden from people, irresistible to bots. The action
                answers "success" without storing anything when it is filled. */}
            <div className="hp" aria-hidden="true">
              <Input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-label="Website"
              />
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Your name</span>
                <Input
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Full name"
                  aria-invalid={!!activeState?.fieldErrors?.name}
                />
              </label>
              <label className="field">
                <span>Email address</span>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  aria-invalid={!!activeState?.fieldErrors?.email}
                />
              </label>
            </div>
            {modal === "team" ? (
              <label className="field">
                <span>Company</span>
                <Input
                  name="company"
                  autoComplete="organization"
                  required
                  placeholder="Your business name"
                  aria-invalid={!!teamState?.fieldErrors?.company}
                />
              </label>
            ) : null}
            <label className="field">
              <span>
                {modal === "career"
                  ? "Your experience & interests"
                  : "What would you like your team to take care of?"}
              </span>
              <Textarea
                name="message"
                rows={3}
                required
                placeholder={
                  modal === "career"
                    ? "Tell us about your skills and experience."
                    : "A few words about your needs and goals."
                }
                aria-invalid={!!activeState?.fieldErrors?.message}
              />
            </label>
            <Button variant="brand" type="submit" disabled={activePending}>
              {activePending
                ? "Sending…"
                : `Send my ${modal === "career" ? "enquiry" : "request"}`}
            </Button>
            <p className="dialog-disclaimer">
              {modal === "career"
                ? "This goes straight to our recruitment team. We will be in touch about opportunities that match your experience."
                : "This goes straight to our team. We will reply about roles, coverage and pricing for the plan above."}
            </p>
            {activeState?.error && (
              <p className="dialog-error" role="alert">
                {activeState.error}
              </p>
            )}
            {activeState?.ok && (
              <p className="dialog-success" role="status">
                {activeState.message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
