/**
 * Application stage metadata.
 *
 * The `application_stage` enum has twelve values. Until now every surface
 * rendered one with `stage.replace(/_/g, " ")`, which is enough to compile and
 * useless to read: "Client endorsement" tells an applicant nothing about
 * whether they are still in the running, and it gives an HR reviewer no way to
 * tell a deliberate `on_hold` from a stalled `screening`.
 *
 * One table drives every surface so the applicant view, the recruiter view and
 * the command palette cannot disagree about what a stage means.
 */

import type { Database } from "@/types/database";

export type ApplicationStage = Database["public"]["Enums"]["application_stage"];

/**
 * Every enum value, in the order the happy path runs. Off-path states are
 * grouped after it rather than scattered, because a reader scanning the list
 * wants to see the pipeline first.
 */
export const APPLICATION_STAGES: readonly ApplicationStage[] = [
  "applied",
  "screening",
  "initial_interview",
  "assessment",
  "client_endorsement",
  "client_interview",
  "offer",
  "hired",
  // Terminal negatives.
  "rejected",
  "withdrawn",
  // Parked, but alive.
  "on_hold",
  "talent_pool",
];

/** The happy-path order, used to render "step 3 of 7" and progress bars. */
export const PIPELINE_STAGES: readonly ApplicationStage[] = [
  "applied",
  "screening",
  "initial_interview",
  "assessment",
  "client_endorsement",
  "client_interview",
  "offer",
  "hired",
];

export type StageTone =
  /** Nothing has happened yet. */
  | "neutral"
  /** Actively moving through the pipeline. */
  | "progress"
  /** Outcome in the applicant's favour. */
  | "positive"
  /** Paused, but not finished. */
  | "warning"
  /** Finished, not in the applicant's favour. */
  | "negative";

export type StageMeta = {
  /** Human-readable name. Never derived from the raw value. */
  label: string;
  tone: StageTone;
  /** Shown to the applicant: what this stage means for them. */
  applicantNote: string;
  /** Shown to HR/recruiters: what this stage means operationally. */
  staffNote: string;
  /** The application will not progress further from here. */
  terminal: boolean;
  /** Position in the happy path, or null when off-path. */
  step: number | null;
};

const META: Record<ApplicationStage, StageMeta> = {
  applied: {
    label: "Applied",
    tone: "neutral",
    applicantNote:
      "We have your application. You will hear from us once it has been reviewed.",
    staffNote: "Awaiting first review. Nothing required yet.",
    terminal: false,
    step: 1,
  },
  screening: {
    label: "Screening",
    tone: "progress",
    applicantNote:
      "Our team is reviewing your experience against the role. No action needed from you.",
    staffNote: "Reviewing CV and experience against the job requirements.",
    terminal: false,
    step: 2,
  },
  initial_interview: {
    label: "Initial interview",
    tone: "progress",
    applicantNote:
      "Your first conversation has been scheduled or is being arranged. Watch your email and phone.",
    staffNote: "Schedule and run the first conversation.",
    terminal: false,
    step: 3,
  },
  assessment: {
    label: "Assessment",
    tone: "progress",
    applicantNote:
      "We have sent an assessment. Please complete it by the stated deadline.",
    staffNote: "Assessment issued; awaiting candidate submission.",
    terminal: false,
    step: 4,
  },
  client_endorsement: {
    label: "Client endorsement",
    tone: "progress",
    applicantNote:
      "Your profile has been shared with the client for their review. This is usually the quickest wait.",
    staffNote: "Awaiting the client's endorsement decision.",
    terminal: false,
    step: 5,
  },
  client_interview: {
    label: "Client interview",
    tone: "progress",
    applicantNote:
      "The client would like to meet you. Expect a scheduling message shortly.",
    staffNote: "Client is interviewing the candidate directly.",
    terminal: false,
    step: 6,
  },
  offer: {
    label: "Offer",
    tone: "progress",
    applicantNote:
      "An offer has been extended. Please review it and respond by the stated date.",
    staffNote: "Offer extended; awaiting candidate decision.",
    terminal: false,
    step: 7,
  },
  hired: {
    label: "Hired",
    tone: "positive",
    applicantNote:
      "Congratulations — you have been accepted. Onboarding details will follow by email.",
    staffNote: "Convert the applicant record to an employee.",
    terminal: true,
    step: 8,
  },
  rejected: {
    label: "Rejected",
    tone: "negative",
    applicantNote:
      "We have decided not to progress your application. Thank you for the time you invested.",
    staffNote: "Closed out. Keep for talent-pool review if appropriate.",
    terminal: true,
    step: null,
  },
  withdrawn: {
    label: "Withdrawn",
    tone: "negative",
    applicantNote: "This application was withdrawn.",
    staffNote: "The candidate withdrew, or we withdrew on their behalf.",
    terminal: true,
    step: null,
  },
  on_hold: {
    label: "On hold",
    tone: "warning",
    applicantNote:
      "Your application is paused while we wait on something. You can re-apply to other roles at any time.",
    staffNote: "Deliberately paused. Not terminal — set a follow-up date or release it.",
    terminal: false,
    step: null,
  },
  talent_pool: {
    label: "Talent pool",
    tone: "warning",
    applicantNote:
      "We have kept your profile for future roles. You will be contacted when a matching one opens.",
    staffNote: "Not progressing for this role, but retained for matching vacancies.",
    terminal: false,
    step: null,
  },
};

/**
 * Metadata for a stage, with a safe fallback.
 *
 * The database is the source of truth and a future migration can add an enum
 * value this table has never heard of. Falling back to a neutral "Unknown"
 * entry means an unmapped stage renders as an obviously-unmapped stage instead
 * of throwing inside a server component and blanking the page.
 */
export function stageMeta(stage: string | null | undefined): StageMeta {
  if (stage && stage in META) {
    return META[stage as ApplicationStage];
  }
  return {
    label: stage ? stage.replace(/_/g, " ") : "Unknown",
    tone: "neutral",
    applicantNote:
      "This stage is not recognised by the application. Please contact HR for an update.",
    staffNote: "Unmapped stage value. Check the enum against the application.",
    terminal: false,
    step: null,
  };
}

export function isTerminalStage(stage: string | null | undefined): boolean {
  return stageMeta(stage).terminal;
}

/**
 * "Step 3 of 8" for the happy path, or null when the candidate is off-pipeline.
 */
export function pipelinePosition(
  stage: string | null | undefined,
): { index: number; total: number } | null {
  const meta = stageMeta(stage);
  if (meta.step === null) return null;
  return { index: meta.step, total: PIPELINE_STAGES.length };
}

/** Every stage as a `{ value, label }` pair, for select inputs. */
export const APPLICATION_STAGE_OPTIONS: readonly { value: ApplicationStage; label: string }[] =
  APPLICATION_STAGES.map((value) => ({ value, label: META[value].label }));