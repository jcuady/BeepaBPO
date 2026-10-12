import { stageMeta, type StageTone } from "@/lib/recruitment/application-stage";
import { cn } from "@/lib/utils";

/**
 * Tone → colour, as classes rather than a Badge variant.
 *
 * `Badge` only ships default/secondary/destructive/outline, which cannot express
 * "positive" or "paused". Every colour here is an existing design token — the
 * app's palette is navy/green/lime/mist, so introducing an amber just for a
 * warning badge would have put an off-palette colour in front of users.
 *
 * Contrast (WCAG AA, 4.5:1 for text):
 *   neutral  slate #667085 on mist                ~4.6:1
 *   progress green-strong #0b6e34 on green/10    ~6.5:1
 *   positive white on green-strong #0b6e34       ~6.5:1
 *   warning  navy #1f2058 on lime/10             ~14:1
 *   negative #b42318 on destructive/10           ~6.0:1
 *
 * `neutral` and `warning` must stay visually distinct — "nothing has happened
 * yet" and "paused, but alive" are different messages. Lime is the brand token
 * that separates them without leaving the palette.
 */
const TONE_CLASS: Record<StageTone, string> = {
  neutral: "border-line bg-mist text-slate",
  progress: "border-green/30 bg-green/10 text-green-strong",
  positive: "border-green-strong bg-green-strong text-white",
  warning: "border-lime bg-lime/15 text-navy",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StageBadge({
  stage,
  className,
}: {
  stage: string | null | undefined;
  className?: string;
}) {
  const meta = stageMeta(stage);
  return (
    <span
      data-stage={stage ?? "unknown"}
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/**
 * Applicant-facing explanation of the current stage.
 *
 * This is the piece that was missing: an applicant who saw "Client
 * endorsement" had no idea whether they were still in the running or waiting
 * on something. The note answers both.
 */
export function StageExplainer({
  stage,
  audience = "applicant",
}: {
  stage: string | null | undefined;
  audience?: "applicant" | "staff";
}) {
  const meta = stageMeta(stage);
  return (
    <div className="rounded-none border border-slate/15 bg-slate/5 p-3">
      <StageBadge stage={stage} />
      <p className="mt-2 text-base text-slate sm:text-sm">
        {audience === "staff" ? meta.staffNote : meta.applicantNote}
      </p>
    </div>
  );
}