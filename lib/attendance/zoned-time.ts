/**
 * Timezone-correct attendance timestamps.
 *
 * The schema requires UTC storage and an explicit IANA timezone on every
 * employee. `clock_event` honours that: it reads `employees.default_timezone`
 * and stores the true instant.
 *
 * The HR manual-entry path did not. `combineLocal` built its timestamp with
 * `new Date(`${workDate}T${hh}:00`)`, which JavaScript parses in the *server's*
 * local timezone. On a UTC host (Vercel) that is Asia/Manila minus 8 hours, so
 * an 08:00 Manila shift stored as `08:00Z` = 16:00 Manila. On a Manila dev
 * machine the same input stored `00:00Z`. Two consequences:
 *
 *   1. The same manual entry produced timestamps 8 hours apart between dev and
 *      production.
 *   2. Manual records disagreed with `clock_event` records in the same table,
 *      which is exactly the kind of drift payroll then reads.
 *
 * Reading had the matching defect: `format(new Date(iso), "h:mm a")` renders in
 * the server timezone, so even a correct instant displayed as 12:00 AM on a
 * UTC host.
 *
 * Both halves live here so they cannot drift apart again.
 */

/** Philippines has no DST, but the offset is still resolved per instant. */
export const DEFAULT_TIMEZONE = "Asia/Manila";

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };

  // Intl renders midnight as hour 24 in some locales; normalise to 0.
  const hour = get("hour") % 24;
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asIfUtc - date.getTime();
}

/**
 * Combine a work date and an `HH:mm` wall-clock reading into a UTC instant,
 * interpreting the reading in `timeZone` rather than the server's zone.
 *
 * Returns null when the inputs are unusable, matching the previous contract.
 */
export function zonedWorkDateTime(
  workDate: string,
  time: string | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!time) return null;

  const hm = time.trim().slice(0, 5);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDate);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!dateMatch || !timeMatch) return null;

  const [, y, m, d] = dateMatch;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;

  const naive = Date.UTC(Number(y), Number(m) - 1, Number(d), hour, minute);

  // Resolve the offset at the guessed instant, then re-resolve once at the
  // corrected instant so DST transitions settle on the right side.
  let guess = naive - tzOffsetMs(new Date(naive), timeZone);
  guess = naive - tzOffsetMs(new Date(guess), timeZone);

  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

/**
 * Render a stored UTC instant as a local wall-clock time in `timeZone`.
 * Safe to call in a server component: it never depends on the host's zone.
 */
export function formatZonedTime(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Same, for a date only, e.g. an NTE response deadline. */
export function formatZonedDate(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Same, for a full date+time, e.g. a payslip coverage line. */
export function formatZonedDateTime(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}