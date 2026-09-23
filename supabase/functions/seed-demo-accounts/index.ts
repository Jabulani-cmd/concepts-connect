// Creates and links the demo school's login accounts.
//
// - With no body it only (re)creates the fixed demo administrator, so the Login
//   page can bootstrap an empty demo system. No sign-in is needed for that.
// - With `accounts` it requires a signed-in school administrator, only touches
//   addresses on the demo domain, and links every login to its school record:
//     student → students.user_id (by admission number)
//     teacher → staff.user_id (by email)
//     parent  → parent_students + parent_student_links for each child, plus a
//               complimentary access grant so the parent and student portals open.
// Safe to re-run: existing users are updated, links are upserted.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_DOMAIN = "schooldemo.com";
const DEMO_ADMIN = { email: `admin@${DEMO_DOMAIN}`, password: "Demo@2025", full_name: "Demo Administrator", role: "admin" as const };
const ROLES = ["admin", "teacher", "student", "parent"] as const;
const MAX_ACCOUNTS_PER_CALL = 60;

type Role = (typeof ROLES)[number];
type Account = {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  /** Student: their admission number. */
  admission_number?: string;
  /** Parent: their children's admission numbers and the relationship to them. */
  children?: { admission_number: string; relationship?: string }[];
};
type Result = { email: string; status: "created" | "updated" | "error"; error?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isDemoEmail = (email: string) => {
  const e = email.toLowerCase();
  return e.endsWith(`@${DEMO_DOMAIN}`) || e.endsWith(`.${DEMO_DOMAIN}`);
};

function validate(raw: unknown): Account | string {
  if (!raw || typeof raw !== "object") return "invalid account";
  const a = raw as Record<string, unknown>;
  if (typeof a.email !== "string" || !isDemoEmail(a.email)) return `only @${DEMO_DOMAIN} addresses can be seeded`;
  if (typeof a.password !== "string" || a.password.length < 8) return "password must be at least 8 characters";
  if (typeof a.full_name !== "string" || !a.full_name.trim()) return "full_name is required";
  if (!ROLES.includes(a.role as Role)) return `role must be one of ${ROLES.join(", ")}`;
  return a as unknown as Account;
}

async function callerIsSchoolAdmin(req: Request, admin: SupabaseClient): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: ok } = await admin.rpc("is_school_admin", { _uid: data.user.id });
  return ok === true;
}

async function upsertUser(admin: SupabaseClient, a: Account, existingId: string | undefined): Promise<{ id: string; created: boolean }> {
  const meta = { full_name: a.full_name, demo: true };
  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, { password: a.password, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    return { id: existingId, created: false };
  }
  const { data, error } = await admin.auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function linkRecords(admin: SupabaseClient, linked: { account: Account; uid: string }[]) {
  // Students: attach the login to the student record.
  const students = linked.filter((l) => l.account.role === "student" && l.account.admission_number);
  for (const { account, uid } of students) {
    await admin.from("students").update({ user_id: uid, email: account.email }).eq("admission_number", account.admission_number!);
  }

  // Teachers: attach the login to the staff record.
  for (const { account, uid } of linked.filter((l) => l.account.role === "teacher")) {
    await admin.from("staff").update({ user_id: uid }).eq("email", account.email);
  }

  // Parents: link every child and open portal access for the demo.
  const parents = linked.filter((l) => l.account.role === "parent" && l.account.children?.length);
  if (!parents.length) return;
  const admissionNumbers = [...new Set(parents.flatMap((p) => p.account.children!.map((c) => c.admission_number)))];
  const { data: rows, error } = await admin.from("students").select("id, admission_number").in("admission_number", admissionNumbers);
  if (error) throw error;
  const studentId = new Map((rows ?? []).map((r) => [r.admission_number, r.id]));

  const pairs = parents.flatMap(({ account, uid }) =>
    account.children!
      .map((c) => ({ parent_id: uid, student_id: studentId.get(c.admission_number), relationship: c.relationship ?? "Parent" }))
      .filter((p): p is { parent_id: string; student_id: string; relationship: string } => !!p.student_id),
  );
  if (!pairs.length) return;

  const { error: psErr } = await admin.from("parent_students").upsert(pairs, { onConflict: "parent_id,student_id" });
  if (psErr) throw psErr;

  const parentIds = [...new Set(pairs.map((p) => p.parent_id))];
  const key = (p: { parent_id: string; student_id: string }) => `${p.parent_id}:${p.student_id}`;

  const { data: links } = await admin.from("parent_student_links").select("parent_id, student_id").in("parent_id", parentIds);
  const haveLink = new Set((links ?? []).map(key));
  const newLinks = pairs.filter((p) => !haveLink.has(key(p))).map((p) => ({ parent_id: p.parent_id, student_id: p.student_id, verified: true }));
  if (newLinks.length) {
    const { error: lErr } = await admin.from("parent_student_links").insert(newLinks);
    if (lErr) throw lErr;
  }

  const { data: grants } = await admin
    .from("access_grants")
    .select("parent_id, student_id")
    .in("parent_id", parentIds)
    .eq("is_active", true);
  const haveGrant = new Set((grants ?? []).map(key));
  const newGrants = pairs
    .filter((p) => !haveGrant.has(key(p)))
    .map((p) => ({ parent_id: p.parent_id, student_id: p.student_id, grant_type: "complimentary", is_active: true, reason: "Demo account" }));
  if (newGrants.length) {
    const { error: gErr } = await admin.from("access_grants").insert(newGrants);
    if (gErr) throw gErr;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const requested: unknown[] = Array.isArray(body?.accounts) ? body.accounts : [];

    let accounts: Account[];
    if (requested.length === 0) {
      accounts = [DEMO_ADMIN];
    } else {
      if (!(await callerIsSchoolAdmin(req, admin))) return json({ error: "Only a school administrator can seed demo accounts" }, 403);
      if (requested.length > MAX_ACCOUNTS_PER_CALL) return json({ error: `Send at most ${MAX_ACCOUNTS_PER_CALL} accounts per call` }, 400);
      const checked = requested.map(validate);
      const bad = checked.find((c) => typeof c === "string");
      if (bad) return json({ error: bad }, 400);
      accounts = checked as Account[];
    }

    // Existing users, found through their profiles (one query instead of paging all auth users).
    const emails = accounts.map((a) => a.email.toLowerCase());
    const { data: profiles, error: pErr } = await admin.from("profiles").select("id, email").in("email", emails);
    if (pErr) throw pErr;
    const existing = new Map((profiles ?? []).map((p) => [String(p.email).toLowerCase(), p.id as string]));

    const results: Result[] = [];
    const linked: { account: Account; uid: string }[] = [];
    for (const a of accounts) {
      try {
        let user: { id: string; created: boolean };
        try {
          user = await upsertUser(admin, a, existing.get(a.email.toLowerCase()));
        } catch (e) {
          // The auth user exists but has no profile yet: find it, then update it.
          if (!String((e as Error).message).toLowerCase().includes("already")) throw e;
          const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = data?.users.find((u) => u.email?.toLowerCase() === a.email.toLowerCase());
          if (!found) throw e;
          user = await upsertUser(admin, a, found.id);
        }

        await admin.from("user_roles").upsert({ user_id: user.id, role: a.role }, { onConflict: "user_id,role" });
        await admin.from("profiles").upsert({ id: user.id, user_id: user.id, full_name: a.full_name, email: a.email }, { onConflict: "id" });
        linked.push({ account: a, uid: user.id });
        results.push({ email: a.email, status: user.created ? "created" : "updated" });
      } catch (e) {
        results.push({ email: a.email, status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    await linkRecords(admin, linked);

    return json({
      ok: true,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
