import Image from "next/image";
import { cn } from "@/lib/utils";
import "./media-hero.css";

export type MediaHeroProps = {
  /** The photograph. `sizes` matters: the media column is half the grid. */
  image: { src: string; alt: string };
  /** The small all-caps label above the headline. */
  eyebrow: string;
  /** The headline. Pass `<br />` for the landing's stacked rhythm. */
  title: React.ReactNode;
  description: React.ReactNode;
  /** The CTA group under the description. */
  actions?: React.ReactNode;
  /** The navy badge in the photograph's top-right corner. */
  topLabel?: string;
  /** The copy across the bottom of the photograph. */
  caption?: {
    title: string;
    subtitle?: string;
    /** Right-aligned lines, e.g. where the team sits. */
    location?: string[];
  };
  /** The strip under the buttons — usually a portrait and one line of copy. */
  foot?: React.ReactNode;
  /** Set for the hero above the fold. */
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/**
 * The photograph hero, shared by the landing page and `/careers`.
 *
 * Why this is a component and not a copy of the landing's markup
 * ---------------------------------------------------------------
 * The landing hero was a set of rules inside `landing.css`, scoped to
 * `.beepaLanding`, so it could not be used anywhere else. A second hero
 * written from scratch to "look like" it would have been the second hero
 * written from scratch — it would have drifted, and the drift would have been
 * invisible until somebody compared the two pages side by side.
 *
 * So there is one hero now. The landing renders it, `/careers` renders it,
 * and the two cannot disagree about the grid, the type scale, the badge, the
 * caption or the scrim, because there is only one copy of each of those.
 *
 * It is deliberately NOT container-aware: the landing's grid sits inside that
 * page's own `.container`, and `/careers` sits inside the shared `Container`.
 * Both are 1360px wide; the hero does not care which one it is in.
 */
export function MediaHero({
  image,
  eyebrow,
  title,
  description,
  actions,
  topLabel,
  caption,
  foot,
  priority = false,
  sizes = "(max-width: 760px) 100vw, 50vw",
  className,
}: MediaHeroProps) {
  return (
    <section className={cn("mh", className)}>
      <div className="mh-copy">
        <p className="mh-eyebrow">{eyebrow}</p>
        <h1 className="mh-title">{title}</h1>
        <p className="mh-description">{description}</p>
        {actions ? <div className="mh-actions">{actions}</div> : null}
        {foot ? <div className="mh-foot">{foot}</div> : null}
      </div>
      <div className="mh-media">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority={priority}
          sizes={sizes}
        />
        {topLabel ? <div className="mh-top">{topLabel}</div> : null}
        {caption ? (
          <div className="mh-caption">
            <div>
              <strong>{caption.title}</strong>
              {caption.subtitle ? <span>{caption.subtitle}</span> : null}
            </div>
            {caption.location?.length ? (
              <div className="mh-caption-location">
                {caption.location.map((line, i) => (
                  <span key={line}>
                    {i > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
