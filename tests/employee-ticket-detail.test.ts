import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("employee ticket detail seam", () => {
  const requests = readFileSync(
    join(process.cwd(), "app/app/my/requests/page.tsx"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/app/my/requests/[id]/page.tsx"),
    "utf8",
  );

  it("lists tickets as links to requester detail", () => {
    expect(requests).toContain('href={`/app/my/requests/${ticket.id}`}');
  });

  it("detail allows requester reply without tickets.read", () => {
    expect(detail).toContain("TicketMessageForm");
    expect(detail).toContain("requester_user_id");
    expect(detail).not.toContain('requirePermission(workspace, "tickets.read")');
  });
});
