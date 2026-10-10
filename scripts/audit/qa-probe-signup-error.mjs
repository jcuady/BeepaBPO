// Diagnose why signupAction reports "Unable to create account with that email."
// The action discards the underlying error, so this reproduces the exact
// signUp() call through the ANON key to see what Supabase actually says.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

for (const domain of ["nowhere.example", "gmail.com", "beepabpo.com"]) {
  const email = `qa.probe.${Date.now()}.${Math.floor(Math.random() * 1e6)}@${domain}`;
  const { data, error } = await anon.auth.signUp({
    email,
    password: "QaSignup#2026x",
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"}/auth/callback` },
  });
  console.log(`domain=${domain.padEnd(16)} user=${data?.user?.id ?? "(none)"} session=${data?.session ? "yes" : "no"} error=${error ? `${error.status ?? ""} ${error.message}` : "none"}`);
  if (data?.user?.id) {
    const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await svc.auth.admin.deleteUser(data.user.id);
    console.log(`  (cleaned up ${data.user.id})`);
  }
}