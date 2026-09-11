/**
 * Verify seeded CRM lead + demo ticket exist (service role).
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

for (const name of [".env.local", ".env"]) {
  const file = resolve(process.cwd(), name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (!(key in process.env)) process.env[key] = value;
  }
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: leads }, { data: tickets }, { data: deals }] =
    await Promise.all([
      admin
        .from("crm_leads")
        .select("company_name,status")
        .eq("contact_email", "ops@northwind-demo.com"),
      admin
        .from("tickets")
        .select("ticket_number,subject,status")
        .eq("ticket_number", "TKT-DEMO-0001"),
      admin
        .from("crm_deals")
        .select("title,stage")
        .eq("title", "Northwind support pod"),
    ]);
  const ok =
    Boolean(leads?.length) && Boolean(tickets?.length) && Boolean(deals?.length);
  console.log(JSON.stringify({ leads, tickets, deals, ok }, null, 2));
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
