// One-off tidy-up: moves receipts and student submissions that were uploaded to the
// public school-media bucket into the private school-private bucket, and points the
// database rows at the private copies. School administrators only.
//
// Works in batches so each call stays well inside the function time limit; the admin
// screen calls it until `remaining` is 0. Safe to re-run.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_BUCKET = "school-media";
const PRIVATE_BUCKET = "school-private";
const PRIVATE_REF = `storage://${PRIVATE_BUCKET}/`;
const BATCH = 25;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Moved = { from: string; to: string };

async function listFolder(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(PUBLIC_BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      // Folders come back without an id.
      if (item.id) out.push(`${prefix}/${item.name}`);
      else out.push(...(await listFolder(admin, `${prefix}/${item.name}`)));
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function move(admin: SupabaseClient, from: string, to: string) {
  const { data: file, error: dlErr } = await admin.storage.from(PUBLIC_BUCKET).download(from);
  if (dlErr) throw dlErr;
  const { error: upErr } = await admin.storage.from(PRIVATE_BUCKET).upload(to, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { error: rmErr } = await admin.storage.from(PUBLIC_BUCKET).remove([from]);
  if (rmErr) throw rmErr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in as a school administrator" }, 401);
    const { data: caller } = await admin.auth.getUser(token);
    const { data: isAdmin } = caller?.user
      ? await admin.rpc("is_school_admin", { _uid: caller.user.id })
      : { data: false };
    if (isAdmin !== true) return json({ error: "Only a school administrator can move files" }, 403);

    const pending = [...(await listFolder(admin, "receipts")), ...(await listFolder(admin, "submissions"))];
    const moved: Moved[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const path of pending.slice(0, BATCH)) {
      try {
        if (path.startsWith("receipts/")) {
          // Receipts are stored privately by payment id, so find the payment that links to this file.
          const { data: payment } = await admin
            .from("payments")
            .select("id")
            .like("receipt_url", `%/${PUBLIC_BUCKET}/${path}`)
            .maybeSingle();
          const to = payment ? `receipts/${payment.id}.pdf` : `receipts/unmatched/${path.slice("receipts/".length)}`;
          await move(admin, path, to);
          if (payment) await admin.from("payments").update({ receipt_url: PRIVATE_REF + to }).eq("id", payment.id);
          moved.push({ from: path, to });
        } else {
          await move(admin, path, path);
          await admin
            .from("assessment_submissions")
            .update({ submission_url: PRIVATE_REF + path })
            .like("submission_url", `%/${PUBLIC_BUCKET}/${path}`);
          moved.push({ from: path, to: path });
        }
      } catch (e) {
        failed.push({ path, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ ok: true, moved: moved.length, failed, remaining: Math.max(0, pending.length - moved.length - failed.length) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
