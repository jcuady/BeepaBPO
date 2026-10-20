import "./assurance-strip.css";

/**
 * The row of short promises under the hero.
 *
 * Same reason as the hero: this was a landing-only rule set, and a careers
 * page that wanted the same rhythm had to have it twice. It is now one
 * component with one stylesheet, so the landing and `/careers` say the same
 * four things in the same way.
 */
export function AssuranceStrip({ items }: { items: readonly string[] }) {
  return (
    <div className="as-strip">
      {items.map((text) => (
        <div key={text}>
          <span className="as-check">✓</span>
          {text}
        </div>
      ))}
    </div>
  );
}
