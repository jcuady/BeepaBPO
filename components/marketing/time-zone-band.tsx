import Image from "next/image";
import { Container } from "@/components/beepa/container";
import { EyebrowPill } from "@/components/marketing/landing-primitives";
import { SectionBackdrop } from "@/components/marketing/landing-primitives";
import supportFloorPhoto from "../../public/images/services/customer-support-floor.webp";

/**
 * Time-zone band — the Philippines next to the markets a client actually works
 * from, on a split with a photograph.
 *
 * WHY THESE ARE FIXED, NOT LIVE
 * A live clock needs client-side JS and a hydration boundary, and it is wrong
 * in the two ways that matter here: it renders differently on the server and
 * the client, and it makes the page's content change without changing. The
 * reference makes the same call and labels the figures *illustrative*, which is
 * the honest framing for "your team is awake while you sleep". The footnote
 * below says so explicitly rather than letting four static numbers imply a
 * live feed.
 *
 * The figures are illustrative for October, with daylight saving observed, and
 * say so. They are not a promise about any client's actual shift.
 */
const ZONES = [
  { city: "Philippines", time: "08:00", note: "Where your dedicated team calls home" },
  { city: "London", time: "01:00", note: "Connected across borders" },
  { city: "New York", time: "20:00", note: "The previous evening" },
  { city: "Sydney", time: "11:00", note: "The same working day" },
] as const;

export function TimeZoneBand() {
  return (
    <section aria-labelledby="time-zone-heading" className="relative isolate">
      <SectionBackdrop />
      <Container className="relative grid gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <EyebrowPill index="03">Across your working day</EyebrowPill>

          <h2
            id="time-zone-heading"
            className="mt-6 font-display text-[clamp(1.875rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.02em] text-balance text-navy"
          >
            Asleep in your timezone.
            <br />
            <span className="text-green-strong">Awake in ours.</span>
          </h2>

          <dl className="mt-8">
            {ZONES.map((zone, i) => (
              <div
                key={zone.city}
                className="flex items-center justify-between gap-6 border-b border-line py-4"
              >
                <dt>
                  <span className="font-display text-[0.9375rem] font-medium text-navy">
                    {zone.city}
                  </span>
                  <small className="mt-1 block font-display text-base text-slate">
                    {zone.note}
                  </small>
                </dt>
                <dd
                  className={
                    "font-display text-3xl font-normal tracking-tight tabular-nums " +
                    // The home base is the point of the row, so it carries the
                    // brand colour and the rest stay ink.
                    (i === 0 ? "text-green-strong" : "text-navy")
                  }
                >
                  {zone.time}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 font-display text-base leading-relaxed text-slate">
            Illustrative time-zone comparison · October, daylight saving observed.
          </p>
        </div>

        <div className="relative min-h-[340px] lg:min-h-full">
          <Image
            src={supportFloorPhoto}
            alt="Beepa support professionals working together beside a window overlooking the Philippines"
            fill
            quality={82}
            sizes="(max-width: 1024px) 92vw, 46vw"
            className="object-cover object-[35%_50%]"
          />
        </div>
      </Container>
    </section>
  );
}