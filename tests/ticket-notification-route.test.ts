import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ticketRouteFor } from "@/lib/notifications/ticket-route";

/**
 * These routes are not interchangeable: `/app/tickets` and `/app/tickets/{id}` call
 * requireInternal, so a client or applicant following one lands on "Access not
 * allowed". The rule exists because six notifications in the demo data did exactly
 * that. A test that only asserts "a string comes back" would pass for every wrong
 * route, so each case names the role that must be able to open the result.
 */
describe("ticketRouteFor", () => {
  it("sends staff to the queue", () => {
    expect(ticketRouteFor("internal")).toBe("/app/tickets");
    expect(ticketRouteFor("internal", "abc")).toBe("/app/tickets/abc");
  });

  it("sends a client to their own ticket list, not the staff queue", () => {
    expect(ticketRouteFor("client")).toBe("/app/client/tickets");
    expect(ticketRouteFor("client", "abc")).toBe("/app/client/tickets/abc");
  });

  it("sends an applicant to their own home, not a ticket list they cannot open", () => {
    // /app/my/requests exists and lists a user's own tickets, but the whole
    // /app/my/* tree is behind the employee shell: an applicant requesting it is
    // redirected to /app, which shows applications, not tickets. Pointing there
    // would trade a dead end for a redirect that implies they can track the ticket.
    expect(ticketRouteFor("applicant")).toBe("/app/applicant");
    expect(ticketRouteFor("applicant", "abc")).toBe("/app/applicant");
  });

  it("never returns a staff route for a non-staff membership", () => {
    for (const type of ["client", "applicant"] as const) {
      expect(ticketRouteFor(type)).not.toContain("/app/tickets");
      expect(ticketRouteFor(type, "abc")).not.toContain("/app/tickets");
    }
  });

  it("falls back to the staff route when the membership is unknown", () => {
    // Degrading to today's behaviour is safer than degrading to a route nobody can
    // open: the staff route is the one requireInternal accepts.
    expect(ticketRouteFor(null)).toBe("/app/tickets");
    expect(ticketRouteFor(undefined)).toBe("/app/tickets");
  });

  it("keeps the applicant and client routes distinct", () => {
    expect(ticketRouteFor("client", "x")).not.toBe(ticketRouteFor("applicant", "x"));
  });
});

describe("the routes it returns actually exist", () => {
  const cases: Array<[string, string, string]> = [
    ["internal list", "/app/tickets", "app/app/tickets/page.tsx"],
    ["internal detail", "/app/tickets/abc", "app/app/tickets/[id]/page.tsx"],
    ["client list", "/app/client/tickets", "app/app/client/tickets/page.tsx"],
    ["client detail", "/app/client/tickets/abc", "app/app/client/tickets/[id]/page.tsx"],
    ["applicant home", "/app/applicant", "app/app/applicant/page.tsx"],
  ];

  /** Turn "app/app/client/tickets/[id]/page.tsx" into "/app/client/tickets/abc". */
  const routeForFile = (file: string) =>
    "/app" +
    file
      .replace(/^app\/app/, "")
      .replace(/\/page\.tsx$/, "")
      .replace(/\/\[id\]$/, "/abc");

  it.each(cases)("%s resolves to a real page", (label, route, file) => {
    expect(existsSync(resolve(process.cwd(), file)), `${label}: missing ${file}`).toBe(true);
    // And the route the helper builds must be the one that file serves, or the fix
    // would be swapping one dead link for another.
    expect(route).toBe(routeForFile(file));
  });

  it("builds exactly these routes", () => {
    expect(ticketRouteFor("internal", "abc")).toBe("/app/tickets/abc");
    expect(ticketRouteFor("client", "abc")).toBe("/app/client/tickets/abc");
    expect(ticketRouteFor("applicant", "abc")).toBe("/app/applicant");
  });

  it("does not point an applicant at /app/my/requests, which redirects them away", () => {
    // Guarding the specific mistake: the file exists, so an existence check alone
    // would pass while the route is unusable for this role.
    expect(existsSync(resolve(process.cwd(), "app/app/my/requests/page.tsx"))).toBe(true);
    expect(ticketRouteFor("applicant")).not.toBe("/app/my/requests");
    expect(ticketRouteFor("applicant", "abc")).not.toContain("/app/my/requests");
  });
});
