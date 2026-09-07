"use client";

import Link from "next/link";
import type { DemoPortal, DemoUser } from "@/lib/demo/users";

type DemoLoginPickerProps = {
  users: readonly DemoUser[];
  portal: DemoPortal;
  password: string;
  onFill: (email: string, password: string) => void;
};

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
      className="mt-6 rounded-[16px] border border-dashed border-line bg-mist/40 p-4"
      data-testid="demo-login-picker"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-navy">
        Demo users
      </p>
      <p className="mt-1 text-xs text-slate">
        Click a role to autofill email + shared demo password (Supabase Auth).
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {matching.map((user) => (
          <button
            key={user.email}
            type="button"
            className="inline-flex min-h-9 items-center rounded-[8px] border border-line bg-white px-3 text-left text-xs font-medium text-navy hover:border-green-strong hover:text-green-strong"
            onClick={() => onFill(user.email, password)}
            title={user.email}
          >
            {user.label}
          </button>
        ))}
      </div>

      {other.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs text-slate">
            Other demo roles use{" "}
            <Link
              href={otherHref}
              className="font-medium text-green-strong hover:underline"
            >
              {otherLabel}
            </Link>
            :
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {other.map((user) => (
              <Link
                key={user.email}
                href={`${otherHref}?demo=${encodeURIComponent(user.email)}`}
                className="inline-flex min-h-9 items-center rounded-[8px] border border-transparent bg-white/70 px-3 text-xs text-slate hover:border-line hover:text-navy"
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
