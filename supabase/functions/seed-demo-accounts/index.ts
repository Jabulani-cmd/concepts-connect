// Seeds demo auth accounts (admin, teachers, students, parents) for the demo environment.
// No JWT required — uses service role and is idempotent. For demo use only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Account = { email: string; password: string; full_name: string; role: "admin" | "teacher" | "student" | "parent" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    let accounts: Account[] = Array.isArray(body?.accounts) ? body.accounts : [];

    // If no accounts payload, default to the demo admin only (fast bootstrap)
    if (accounts.length === 0) {
      accounts = [{
        email: "admin@schooldemo.com",
        password: "Demo@2025",
        full_name: "Demo Administrator",
        role: "admin",
      }];
    }

    // Build an email -> existing user map (paginate through admin users)
    const existingByEmail = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      data.users.forEach(u => { if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id); });
      if (!data.users.length || data.users.length < 1000) break;
      page++;
      if (page > 10) break; // safety
    }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const a of accounts) {
      try {
        const emailKey = a.email.toLowerCase();
        let uid = existingByEmail.get(emailKey);

        if (uid) {
          await supabase.auth.admin.updateUserById(uid, {
            password: a.password,
            email_confirm: true,
            user_metadata: { full_name: a.full_name, demo: true },
          });
          results.push({ email: a.email, status: "updated" });
        } else {
          const { data, error } = await supabase.auth.admin.createUser({
            email: a.email,
            password: a.password,
            email_confirm: true,
            user_metadata: { full_name: a.full_name, demo: true },
          });
          if (error) throw error;
          uid = data.user.id;
          results.push({ email: a.email, status: "created" });
        }

        // Ensure role
        await supabase.from("user_roles").upsert(
          { user_id: uid, role: a.role },
          { onConflict: "user_id,role" }
        );

        // Ensure profile
        await supabase.from("profiles").upsert(
          { id: uid, user_id: uid, full_name: a.full_name, email: a.email },
          { onConflict: "id" }
        );
      } catch (e) {
        results.push({ email: a.email, status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    const created = results.filter(r => r.status === "created").length;
    const updated = results.filter(r => r.status === "updated").length;
    const errors = results.filter(r => r.status === "error").length;

    return new Response(JSON.stringify({ ok: true, created, updated, errors, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
