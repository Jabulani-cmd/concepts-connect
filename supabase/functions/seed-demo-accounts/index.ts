// Creates and links the demo school's login accounts.
//
// - With no body it only (re)creates the fixed demo administrator, so the Login
//   page can bootstrap an empty demo system. No sign-in is needed for that, which
//   means anyone can become the demo administrator: set DEMO_MODE=off before real use.
// - With `accounts` it requires a signed-in school administrator, only touches
//   addresses on the demo domain, and links every login to its school record:
//     student → students.user_id (by admission number)
//     staff   → staff.user_id (by email): teachers, heads of department (who also
//               get the teacher role), leadership, office and support staff
//     parent  → parent_students + parent_student_links for each child, plus a
//               complimentary access grant so the parent and student portals open.
// Safe to re-run: existing users are updated, links are upserted.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_DOMAIN = "schooldemo.com";
const DEMO_STUDENT_EMAIL = /^cla9\d{4}@concepts-academy\.co\.zw$/i;
const DEMO_ADMIN = { email: `admin@${DEMO_DOMAIN}`, password: "MbsDemo#Admin26", full_name: "Demo Administrator", role: "admin" as const };
// Staff roles other than admin: each such login is linked to the staff record with its email.
const STAFF_ROLES = [
  "teacher", "hod", "principal", "deputy_principal", "admin_supervisor", "bursar", "finance", "finance_clerk",
  "registration", "boarding", "nurse", "librarian", "storekeeper",
] as const;
const ROLES = ["admin", "student", "parent", ...STAFF_ROLES] as const;
// Heads of department teach as well, so they also get the teacher role.
const EXTRA_ROLES: Partial<Record<string, string[]>> = { hod: ["teacher"] };
const MAX_ACCOUNTS_PER_CALL = 60;
const USER_PAGES = 10; // up to 10,000 users when looking one up by email

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
  // Demo learners use the school's own format in a reserved block (CLA90001-CLA99999),
  // so real learners' accounts can never be created or reset from here.
  return e.endsWith(`@${DEMO_DOMAIN}`) || e.endsWith(`.${DEMO_DOMAIN}`) || DEMO_STUDENT_EMAIL.test(e);
};

function validate(raw: unknown): Account | string {
  if (!raw || typeof raw !== "object") return "invalid account";
  const a = raw as Record<string, unknown>;
  if (typeof a.email !== "string" || !isDemoEmail(a.email)) return `only @${DEMO_DOMAIN} addresses and demo learners (CLA90001 and up) can be seeded`;
  if (typeof a.password !== "string" || a.password.length < 8) return "password must be at least 8 characters";
  if (typeof a.full_name !== "string" || !a.full_name.trim()) return "full_name is required";
  if (!ROLES.includes(a.role as Role)) return `role must be one of ${ROLES.join(", ")}`;
  return a as unknown as Account;
}

const ADMIN_ROLES = ["admin", "admin_supervisor", "principal", "deputy_principal", "supervisor"];

/** Returns null when the caller is a school administrator, else why not. */
async function adminCheckFailure(req: Request, admin: SupabaseClient): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return "you are not signed in";

  // getClaims verifies the token with the project's signing keys (works with the
  // newer asymmetric keys); getUser asks the auth server and is the fallback.
  let uid: string | undefined;
  let verifyError = "";
  try {
    const { data, error } = await admin.auth.getClaims(token);
    if (error) verifyError = error.message;
    uid = typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;
  } catch (e) {
    verifyError = e instanceof Error ? e.message : String(e);
  }
  if (!uid) {
    const { data, error } = await admin.auth.getUser(token);
    if (error) verifyError = error.message;
    uid = data?.user?.id;
  }
  if (!uid) return `your sign-in could not be verified (${verifyError || "no user in token"}). Sign out and sign in again`;

  const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", uid);
  if (error) return `your roles could not be read (${error.message})`;
  if (!(roles ?? []).some((r) => ADMIN_ROLES.includes(String(r.role)))) return "your account does not have an administrator role";
  return null;
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

/** Finds an auth user by email when no profile row points to it yet. */
async function findUserId(admin: SupabaseClient, email: string): Promise<string | undefined> {
  for (let page = 1; page <= USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) return undefined;
  }
  return undefined;
}

/** The staff directory category for a staff role. */
function staffCategory(role: string): string {
  if (role === "teacher" || role === "hod") return "teaching";
  if (role === "principal" || role === "deputy_principal") return "leadership";
  if (["admin_supervisor", "bursar", "finance", "finance_clerk", "registration"].includes(role)) return "administrative";
  return "support";
}

/** Links each login to its school record. Returns a problem per account that could not be linked. */
async function linkRecords(admin: SupabaseClient, linked: { account: Account; uid: string }[]): Promise<Map<string, string>> {
  const problems = new Map<string, string>();

  // Students: attach the login to the student record (by admission number, else by email).
  const students = linked.filter((l) => l.account.role === "student");
  for (const { account, uid } of students) {
    const byAdmission = account.admission_number
      ? await admin.from("students").update({ user_id: uid, email: account.email }).eq("admission_number", account.admission_number).select("id")
      : { data: [], error: null };
    if (byAdmission.error) { problems.set(account.email, `student record: ${byAdmission.error.message}`); continue; }
    if (byAdmission.data?.length) continue;
    const byEmail = await admin.from("students").update({ user_id: uid }).eq("email", account.email).select("id");
    if (byEmail.error) problems.set(account.email, `student record: ${byEmail.error.message}`);
    else if (!byEmail.data?.length) problems.set(account.email, `no student record with admission number ${account.admission_number ?? "?"}. Load the demo data first`);
  }

  // Teachers, heads of department, leadership, office and support staff: attach the login to the staff record.
  // If the record can't be found (it may have been cleared, or written a moment ago and not yet
  // visible), create it, so every demo staff login always ends up with a staff record.
  for (const { account, uid } of linked.filter((l) => (STAFF_ROLES as readonly string[]).includes(l.account.role))) {
    const { data, error } = await admin.from("staff").update({ user_id: uid }).eq("email", account.email).select("id");
    if (error) { problems.set(account.email, `staff record: ${error.message}`); continue; }
    if (data?.length) continue;
    const { error: insErr } = await admin.from("staff").insert({
      user_id: uid, full_name: account.full_name, email: account.email, role: account.role,
      category: staffCategory(account.role), status: "active",
    });
    if (insErr) problems.set(account.email, `staff record could not be created: ${insErr.message}`);
  }

  // Parents: link every child and open portal access for the demo.
  const parents = linked.filter((l) => l.account.role === "parent" && l.account.children?.length);
  if (!parents.length) return problems;
  const admissionNumbers = [...new Set(parents.flatMap((p) => p.account.children!.map((c) => c.admission_number)))];
  const { data: rows, error } = await admin.from("students").select("id, admission_number").in("admission_number", admissionNumbers);
  if (error) throw error;
  const studentId = new Map((rows ?? []).map((r) => [r.admission_number, r.id]));

  for (const { account } of parents) {
    const missing = account.children!.filter((c) => !studentId.has(c.admission_number)).map((c) => c.admission_number);
    if (missing.length) problems.set(account.email, `no student record for ${missing.join(", ")}. Load the demo data first`);
  }
  const pairs = parents.flatMap(({ account, uid }) =>
    account.children!
      .map((c) => ({ parent_id: uid, student_id: studentId.get(c.admission_number), relationship: c.relationship ?? "Parent" }))
      .filter((p): p is { parent_id: string; student_id: string; relationship: string } => !!p.student_id),
  );
  if (!pairs.length) return problems;

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
  return problems;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Before a real school goes live, set the DEMO_MODE secret to "off": the known
  // demo administrator login and demo seeding are then refused.
  if ((Deno.env.get("DEMO_MODE") ?? "on").toLowerCase() === "off") {
    return json({ error: "Demo mode is switched off for this school." }, 403);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const requested: unknown[] = Array.isArray(body?.accounts) ? body.accounts : [];

    let accounts: Account[];
    if (requested.length === 0) {
      accounts = [DEMO_ADMIN];
    } else {
      const notAdmin = await adminCheckFailure(req, admin);
      if (notAdmin) return json({ error: `Only a school administrator can seed demo accounts: ${notAdmin}` }, 403);
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
          const found = await findUserId(admin, a.email);
          if (!found) throw e;
          user = await upsertUser(admin, a, found);
        }

        const roles = [a.role, ...(EXTRA_ROLES[a.role] ?? [])].map((role) => ({ user_id: user.id, role }));
        const { error: roleErr } = await admin.from("user_roles").upsert(roles, { onConflict: "user_id,role" });
        if (roleErr) throw new Error(`role: ${roleErr.message}`);
        const { error: profErr } = await admin.from("profiles").upsert({ id: user.id, user_id: user.id, full_name: a.full_name, email: a.email }, { onConflict: "id" });
        if (profErr) throw new Error(`profile: ${profErr.message}`);
        linked.push({ account: a, uid: user.id });
        results.push({ email: a.email, status: user.created ? "created" : "updated" });
      } catch (e) {
        results.push({ email: a.email, status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    const problems = await linkRecords(admin, linked);
    for (const r of results) {
      const problem = problems.get(r.email);
      if (problem && r.status !== "error") Object.assign(r, { status: "error", error: `login created but not linked: ${problem}` });
    }

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
