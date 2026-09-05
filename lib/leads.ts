/** Lead persistence interface. Console impl for this pass. */
export type Lead = {
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: string;
};

export interface LeadSink {
  submit(lead: Lead): Promise<void>;
}

export const consoleLeadSink: LeadSink = {
  async submit(lead) {
    console.info("[Beepa lead]", JSON.stringify(lead));
  },
};

// ponytail: in-memory rate limit; ceiling = single-process. Upgrade: Redis/Upstash.
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
