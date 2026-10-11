/**
 * Where a ticket notification should send its recipient, by membership type.
 *
 * WHY THIS EXISTS
 * `createTicket` and `assignTicket` both hardcoded the STAFF queue route
 * (`/app/tickets`, `/app/tickets/{id}`) on the notification. Those routes call
 * `requireInternal`, so the recipient sees a perfectly laid out page whose entire
 * content is "Access not allowed" — the notification inbox's one link is a dead end.
 *
 * This is not theoretical in the demo data: six notifications held by a non-internal
 * recipient pointed at an `/app/` route they cannot open, three of them
 * `ticket.created` (the person who raised the ticket) and three `ticket.assigned`
 * (a ticket assigned to a client-side user). Found by
 * `qa-exercise-internal-links.mjs`, which walks every link each role can reach and
 * judges it by where it LANDS rather than by whether it has an href.
 *
 * WHY IT IS A SEPARATE MODULE
 * The rule is pure string work over an enum, so it can be unit-tested without a
 * signed-in actor, an assigned ticket or a working SMTP provider — the same reason
 * the admin invite path lives in `lib/admin/role-assignment.ts`. A test that needs a
 * browser to run is a test nobody runs.
 */

/** `public.membership_type` — internal, client, applicant. */
export type TicketMembershipType = "internal" | "client" | "applicant";

/**
 * The ticket route a member of `membershipType` is actually allowed to open.
 *
 * `applicant` maps to `/app/applicant`, not to a ticket list, and that is not a
 * shortcut — it is the honest answer. There is **no applicant-facing ticket surface**
 * in this product: `/app/my/requests` exists and lists a user's own tickets by
 * `requester_user_id`, but the whole `/app/my/*` tree is behind the employee/staff
 * shell, so an applicant requesting it is redirected to `/app` — their home, which
 * shows applications, not tickets. Sending them to `/app/my/requests` would trade a
 * dead end for a redirect that implies they can track the ticket and then does not
 * show it. `/app/applicant` is where they actually are.
 *
 * Giving applicants a real ticket list is a product decision, not a routing one.
 * Until then this is the destination that does not lie to them.
 *
 * Unknown or missing types fall back to the staff route. That is deliberate: the
 * default has to be the route the product's own `requireInternal` guards accept, so
 * a bad lookup degrades to today's behaviour rather than to a route nobody can open.
 */
export function ticketRouteFor(
  membershipType: TicketMembershipType | null | undefined,
  ticketId?: string,
): string {
  if (membershipType === "client") {
    return ticketId ? `/app/client/tickets/${ticketId}` : "/app/client/tickets";
  }
  if (membershipType === "applicant") return "/app/applicant";
  return ticketId ? `/app/tickets/${ticketId}` : "/app/tickets";
}