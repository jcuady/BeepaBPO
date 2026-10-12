import { Container } from "@/components/beepa/container";

/**
 * The promise — three words, one sentence each.
 *
 * `Dedicated. Connected. Accountable.` is the brandbook's own vocabulary, so
 * this is not new copy; it is the promise line given room to be read. The
 * reference sets each word at 33px in the brand green, separated by hairlines
 * rather than cards — no boxes, no icons, no badges.
 *
 * Separators are `border-l` on every article except the first, so the first
 * column has no leading rule and the row reads as one unit rather than as
 * three boxed items.
 */
const PROMISES = [
  {
    word: "Dedicated.",
    title: "A team that feels like yours.",
    body: "People who learn your business, represent your brand, and become part of your everyday.",
  },
  {
    word: "Connected.",
    title: "Distance without disconnect.",
    body: "Shared workflows and web and mobile access keep you close to the work and the people.",
  },
  {
    word: "Accountable.",
    title: "A partnership with visibility.",
    body: "Clear expectations, transparent costs, and performance conversations grounded in the work.",
  },
] as const;

export function PromiseTrio() {
  return (
    <section aria-labelledby="promise-heading" className="border-b border-line bg-white">
      <h2 id="promise-heading" className="sr-only">
        What Beepa commits to
      </h2>
      <Container className="py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-3 lg:gap-10">
          {PROMISES.map((p, i) => (
            <article
              key={p.word}
              className={
                i > 0 ? "lg:border-l lg:border-line lg:pl-10" : undefined
              }
            >
              <p className="font-display text-[2.0625rem] leading-none font-medium tracking-[-0.02em] text-green-strong">
                {p.word}
              </p>
              <h3 className="mt-3 font-display text-base font-semibold text-navy">
                {p.title}
              </h3>
              <p className="mt-2 max-w-[34ch] font-display text-base leading-[1.8] text-slate">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}