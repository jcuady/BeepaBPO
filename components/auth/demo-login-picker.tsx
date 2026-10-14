"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DemoPortal, DemoUser } from "@/lib/demo/users";

type DemoLoginPickerProps = {
  users: readonly DemoUser[];
  portal: DemoPortal;
  password: string;
  onFill: (email: string, password: string) => void;
};

/**
 * One-click role sign-in for QA.
 *
 * A card per role rather than a strip of small buttons: the whole point is to
 * be readable at a glance while testing, and a thirteen-button row is neither.
 * Each card names the role AND where it lands, so picking a role also tells you
 * the route you are about to exercise — `docs/TESTING.md` is the long version.
 *
 * Clicking fills the form rather than submitting it. An autofill that also
 * submits would make a mis-click a real sign-in, and the confirm step is one
 * extra click for something that is otherwise two.
 *
 * This is gated at the call site by `getDemoLoginConfig`, which returns null in
 * production unless `ALLOW_DEMO_LOGIN=true`. Do not render it unconditionally —
 * these are real accounts in the real auth project.
 */
export function DemoLoginPicker({
  users,
  portal,
  password,
  onFill,
}: DemoLoginPickerProps) {
  const matching = users.filter((u) => u.portal === portal);
  const other = users.filter((u) => u.portal !== portal);
  const otherHref = portal === "employee" ? "/login" : "/employee/login";
  const otherLabel =
    portal === "employee" ? "client / applicant login" : "employee login";

  return (
    <div
      className="mt-6 rounded-none border border-dashed border-line bg-mist/40 p-4 sm:p-5"
      data-testid="demo-login-picker"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-xs font-semibold tracking-[0.14em] text-navy uppercase">
          Demo users
        </p>
        {/* 11px was below the mobile body-copy floor. The instruction is the
            one line that tells a first-time tester what the grid does, so it
            is running copy, not a caption. */}
        <p className="text-base md:text-[11px] text-slate">
          Click a role to fill the form, then Sign in.
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {matching.map((user) => (
          <Button
            key={user.email}
            variant="outline"
            type="button"
            className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 rounded-none border-line bg-white px-3 py-2 text-left hover:border-primary hover:bg-white"
            onClick={() => onFill(user.email, password)}
            title={`${user.email} — lands on ${user.landing}`}
          >
            <span className="text-sm font-semibold text-navy">{user.label}</span>
            <span className="text-[11px] font-normal text-slate">
              {user.landing}
            </span>
          </Button>
        ))}
      </div>

      {other.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs text-slate">
            {matching.length} {portal} role{matching.length === 1 ? "" : "s"}{" "}
            above. The rest use{" "}
            <Link
              href={otherHref}
              className="font-medium text-green-strong hover:underline"
            >
              {otherLabel}
            </Link>
            :
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {other.map((user) => (
              <Link
                key={user.email}
                href={`${otherHref}?demo=${encodeURIComponent(user.email)}`}
                // `min-h-9 [@media(pointer:coarse)]:min-h-11` is the convention
                // recorded in docs/SYSTEM_AUDIT.md for role-switch links: 36px
                // for a pointer, 44px for a finger. A bare `min-h-9` here is
                // what the responsive gate flags as a touch-target failure.
                className="inline-flex min-h-9 [@media(pointer:coarse)]:min-h-11 items-center rounded-none border border-transparent bg-white/70 px-2.5 text-xs text-slate hover:border-line hover:text-navy"
                title={`Open ${otherHref} as ${user.email}`}
              >
                {user.label} →
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}