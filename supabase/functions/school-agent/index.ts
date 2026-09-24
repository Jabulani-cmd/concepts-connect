// School monitoring agent. Checks the school's records and raises findings for staff:
//   at_risk               learners whose attendance, marks or homework have slipped
//   attendance_not_taken  class registers not recorded today (after 10:00, school days)
//   marks_overdue         homework/tests past due a week with most marks not entered
//   fee_arrears           weekly summary of invoices unpaid 30+ days after due (office staff)
// Rules decide who is flagged; AI only writes the explanation, and receives no names or
// ids. Staff review every finding; nothing is sent to families and no action is taken
// automatically. Findings clear themselves when the register or marks are entered.
//
// Called every 15 minutes by a database job (with the key kept in agent_settings, or an
// AGENT_CRON_SECRET secret, in the "x-agent-secret" header), and by school leaders and
// HODs (signed in) with "Run now".
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ruleExplanation, scoreLearner, RISK_RULES, type LearnerSignals, type RiskResult } from "./rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

const MODEL = "google/gemini-2.5-flash";
const AI_BATCH = 25;
const TIME_ZONE = "Africa/Harare";

/** JSON with keys in a fixed order, to tell whether a learner's numbers have changed. */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

const json = (body: unknown, status = 200) =>
  new Response(noEmDash(JSON.stringify(body)), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Finding = {
  kind: "at_risk" | "attendance_not_taken" | "marks_overdue" | "fee_arrears";
  severity: "low" | "medium" | "high";
  title: string;
  dedupe_key: string;
  student_id?: string | null;
  class_id?: string | null;
  assessment_id?: string | null;
  assigned_to?: string | null;
  score?: number | null;
  signals: Record<string, unknown>;
  explanation: string;
  suggested_actions: string[];
  explanation_source: string;
};

function harareNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday as string };
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}

/** Asks the AI for explanations of anonymised learner signals. Returns null if unavailable. */
async function explainWithAi(items: { form: string | null; risk: RiskResult; signals: LearnerSignals }[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !items.length) return null;
  const payload = items.map((it, i) => ({
    i,
    form: it.form ?? "unknown form",
    attendance_before_pct: it.signals.attendance_before,
    attendance_last_4_weeks_pct: it.signals.attendance_recent,
    subjects_declining: it.risk.declining,
    homework_missed: `${it.signals.assignments_missed} of ${it.signals.assignments_due}`,
    rule_points: it.risk.points,
  }));
  const system =
    "You help teachers at a Zimbabwean secondary school (ZIMSEC, Forms 1-6) support learners. For each anonymised learner, " +
    "write a short, factual, supportive explanation (2 sentences max) quoting the numbers given, and 1 to 3 practical next steps " +
    "for the class teacher. Never be punitive, never suggest discipline, never guess causes such as family or health problems. " +
    'Reply with JSON only: {"items":[{"i":number,"explanation":string,"actions":string[]}]}.' + NO_EM_DASH;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { items?: { i: number; explanation: string; actions: string[] }[] };
    const out = new Map<number, { explanation: string; actions: string[] }>();
    for (const it of parsed.items ?? []) {
      if (typeof it.i === "number" && typeof it.explanation === "string") {
        out.set(it.i, { explanation: noEmDash(it.explanation), actions: (it.actions ?? []).filter((a) => typeof a === "string").map(noEmDash).slice(0, 3) });
      }
    }
    return out;
  } catch {
    return null;
  }
}

async function callerAllowed(admin: SupabaseClient, req: Request): Promise<{ ok: boolean; uid: string | null; trigger: string }> {
  const given = req.headers.get("x-agent-secret");
  if (given) {
    const envSecret = Deno.env.get("AGENT_CRON_SECRET");
    const { data: settings } = await admin.from("agent_settings").select("cron_secret").eq("id", 1).maybeSingle();
    if ((envSecret && given === envSecret) || (settings?.cron_secret && given === settings.cron_secret)) {
      return { ok: true, uid: null, trigger: "schedule" };
    }
    return { ok: false, uid: null, trigger: "schedule" };
  }
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, uid: null, trigger: "manual" };
  const { data } = await admin.auth.getUser(token);
  const uid = data?.user?.id ?? null;
  if (!uid) return { ok: false, uid: null, trigger: "manual" };
  const [{ data: isAdmin }, { data: isHod }] = await Promise.all([
    admin.rpc("is_school_admin", { _uid: uid }),
    admin.rpc("has_role", { _user_id: uid, _role: "hod" }),
  ]);
  return { ok: isAdmin === true || isHod === true, uid, trigger: "manual" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const caller = await callerAllowed(admin, req);
  if (!caller.ok) return json({ error: "Only school leaders and heads of department can run the agent" }, 403);
  const body = await req.json().catch(() => ({}));
  const trigger = caller.trigger === "schedule" ? "schedule" : body?.trigger === "auto" ? "auto" : "manual";

  // One run at a time.
  const { data: running } = await admin.from("agent_runs").select("id").eq("status", "running")
    .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()).limit(1);
  if (running?.length) return json({ ok: true, already_running: true });

  const { data: run, error: runErr } = await admin.from("agent_runs")
    .insert({ trigger, triggered_by: caller.uid, status: "running" }).select("id").single();
  if (runErr) return json({ error: runErr.message }, 500);

  try {
    const now = harareNow();
    const findings: Finding[] = [];
    const resolvedKeys: string[] = [];
    let aiUsed = false;

    // Class teachers (login user ids) for assigning findings.
    const { data: classes } = await admin.from("classes").select("id, name, class_teacher_id, staff:class_teacher_id(user_id)");
    const classTeacher = new Map<string, string | null>();
    const className = new Map<string, string>();
    type TeacherRef = { user_id: string | null };
    for (const c of (classes ?? []) as unknown as { id: string; name: string; staff: TeacherRef | TeacherRef[] | null }[]) {
      const teacher = Array.isArray(c.staff) ? c.staff[0] : c.staff;
      classTeacher.set(c.id, teacher?.user_id ?? null);
      className.set(c.id, c.name);
    }

    // ---------- 1. Learners at risk ----------
    const { data: signals, error: sigErr } = await admin.rpc("agent_student_signals", { _recent_days: 28, _term_days: 120 });
    if (sigErr) throw sigErr;
    type Row = LearnerSignals & { student_id: string; class_id: string; class_name: string; form: string | null };
    const flagged = ((signals ?? []) as Row[])
      .map((row) => ({ row, risk: scoreLearner({ ...row, subjects: row.subjects ?? [] }) }))
      .filter(({ risk }) => risk.points >= RISK_RULES.flagAt);

    // Skip learners whose finding was dismissed in the last 14 days, unless things got worse.
    const { data: recentDismissed } = await admin.from("agent_findings").select("dedupe_key, score")
      .eq("kind", "at_risk").eq("status", "dismissed").gte("reviewed_at", new Date(Date.now() - 14 * 86400000).toISOString());
    const dismissedScore = new Map((recentDismissed ?? []).map((d) => [d.dedupe_key, d.score ?? 0]));
    const toExplain = flagged.filter(({ row, risk }) => !(dismissedScore.has(`risk:${row.student_id}`) && risk.points <= (dismissedScore.get(`risk:${row.student_id}`) ?? 0)));

    // Reuse the explanation when a learner's numbers haven't changed since the last run,
    // so the AI is only asked about new or changed cases.
    const { data: openRisk } = await admin.from("agent_findings").select("dedupe_key, signals, explanation, suggested_actions, explanation_source")
      .eq("kind", "at_risk").in("status", ["open", "acknowledged"]);
    const previous = new Map((openRisk ?? []).map((r) => [r.dedupe_key, r]));

    const prepared = toExplain.map(({ row, risk }) => {
      const signalsObj = {
        attendance_before: row.attendance_before, attendance_recent: row.attendance_recent,
        subjects_declining: risk.declining, assignments_due: row.assignments_due, assignments_missed: row.assignments_missed,
        reasons: risk.reasons,
      };
      const prev = previous.get(`risk:${row.student_id}`);
      const unchanged = !!prev?.explanation && stableJson(prev.signals) === stableJson(signalsObj);
      return { row, risk, signalsObj, prev: unchanged ? prev : null };
    });
    const needAi = prepared.filter((p) => !p.prev);
    const aiText = new Map<string, { explanation: string; actions: string[] }>();
    for (let i = 0; i < needAi.length; i += AI_BATCH) {
      const batch = needAi.slice(i, i + AI_BATCH);
      const ai = await explainWithAi(batch.map(({ row, risk }) => ({ form: row.form, risk, signals: row })));
      batch.forEach(({ row }, k) => {
        const fromAi = ai?.get(k);
        if (fromAi) { aiUsed = true; aiText.set(row.student_id, fromAi); }
      });
    }

    for (const { row, risk, signalsObj, prev } of prepared) {
      const fromAi = aiText.get(row.student_id);
      const fallback = ruleExplanation(risk);
      findings.push({
        kind: "at_risk",
        severity: risk.severity === "high" ? "high" : "medium",
        title: `Learner may need support (${row.class_name})`,
        dedupe_key: `risk:${row.student_id}`,
        student_id: row.student_id,
        class_id: row.class_id,
        assigned_to: classTeacher.get(row.class_id) ?? null,
        score: risk.points,
        signals: signalsObj,
        explanation: prev?.explanation ?? fromAi?.explanation ?? fallback.explanation,
        suggested_actions: prev ? (prev.suggested_actions as string[]) : fromAi?.actions?.length ? fromAi.actions : fallback.actions,
        explanation_source: prev?.explanation_source ?? (fromAi ? `ai:${MODEL}` : "rules"),
      });
    }
    const flaggedKeys = new Set(flagged.map(({ row }) => `risk:${row.student_id}`));

    // ---------- 2. Registers not taken today ----------
    const schoolDay = !["Sat", "Sun"].includes(now.weekday);
    const { data: rosters } = await admin.from("student_classes").select("class_id");
    const classesWithLearners = new Set((rosters ?? []).map((r) => r.class_id as string));
    if (schoolDay && now.hour >= 10) {
      const { data: taken } = await admin.from("attendance").select("class_id").eq("date", now.date);
      const takenClasses = new Set((taken ?? []).map((t) => t.class_id as string));
      for (const cid of classesWithLearners) {
        if (takenClasses.has(cid)) continue;
        findings.push({
          kind: "attendance_not_taken", severity: "low",
          title: `Register not taken today (${className.get(cid) ?? "class"})`,
          dedupe_key: `register:${cid}:${now.date}`,
          class_id: cid, assigned_to: classTeacher.get(cid) ?? null,
          signals: { date: now.date },
          explanation: `No attendance has been recorded for ${className.get(cid) ?? "this class"} today.`,
          suggested_actions: ["Record today's register in the Attendance section."],
          explanation_source: "rules",
        });
      }
    }
    // Registers recorded since: close those findings.
    const { data: openRegisters } = await admin.from("agent_findings").select("dedupe_key, class_id, signals")
      .eq("kind", "attendance_not_taken").in("status", ["open", "acknowledged"]);
    for (const f of openRegisters ?? []) {
      const date = (f.signals as { date?: string })?.date;
      if (!date || !f.class_id) continue;
      const { count } = await admin.from("attendance").select("id", { count: "exact", head: true }).eq("class_id", f.class_id).eq("date", date);
      if ((count ?? 0) > 0 || date < now.date) resolvedKeys.push(f.dedupe_key);
    }

    // ---------- 3. Marks overdue ----------
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const { data: dueWork } = await admin.from("assessments").select("id, title, class_id, teacher_id, due_date")
      .eq("is_published", true).lte("due_date", weekAgo).gte("due_date", twoMonthsAgo).not("class_id", "is", null);
    const rosterSize = new Map<string, number>();
    for (const r of rosters ?? []) rosterSize.set(r.class_id as string, (rosterSize.get(r.class_id as string) ?? 0) + 1);
    for (const a of dueWork ?? []) {
      const size = rosterSize.get(a.class_id) ?? 0;
      if (!size) continue;
      const { count } = await admin.from("assessment_results").select("id", { count: "exact", head: true }).eq("assessment_id", a.id);
      const key = `marks:${a.id}`;
      if ((count ?? 0) >= size * 0.5) { resolvedKeys.push(key); continue; }
      findings.push({
        kind: "marks_overdue", severity: "medium",
        title: `Marks not entered: ${a.title} (${className.get(a.class_id) ?? "class"})`,
        dedupe_key: key, class_id: a.class_id, assessment_id: a.id,
        assigned_to: a.teacher_id ?? classTeacher.get(a.class_id) ?? null,
        signals: { due_date: a.due_date, results_entered: count ?? 0, learners: size },
        explanation: `${a.title} was due on ${a.due_date}; marks are entered for ${count ?? 0} of ${size} learners.`,
        suggested_actions: ["Enter the remaining marks so learners and parents can see their results."],
        explanation_source: "rules",
      });
    }

    // ---------- 4. Fee arrears (weekly summary for office staff) ----------
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: overdue } = await admin.from("invoices").select("id, student_id, total_usd, paid_usd, amount_usd, amount_paid, due_date")
      .lt("due_date", monthAgo).limit(5000);
    const owing = (overdue ?? [])
      .map((i) => ({ ...i, balance: Number(i.total_usd ?? i.amount_usd ?? 0) - Number(i.paid_usd ?? i.amount_paid ?? 0) }))
      .filter((i) => i.balance > 0.009);
    if (owing.length) {
      const total = Math.round(owing.reduce((s, i) => s + i.balance, 0) * 100) / 100;
      findings.push({
        kind: "fee_arrears", severity: owing.length > 50 ? "high" : "medium",
        title: `${owing.length} invoices unpaid more than 30 days after due`,
        dedupe_key: `fees:${isoWeek(new Date())}`,
        signals: { invoices: owing.length, learners: new Set(owing.map((i) => i.student_id)).size, total_usd: total },
        explanation: `${owing.length} invoices for ${new Set(owing.map((i) => i.student_id)).size} learners are more than 30 days overdue, totalling US$ ${total.toFixed(2)}.`,
        suggested_actions: ["Review the debtors list in Finance.", "Send polite reminders to the families concerned (drafts can be prepared with the parent message tool)."],
        explanation_source: "rules",
      });
    }

    // ---------- Save ----------
    const { data: openRows } = await admin.from("agent_findings")
      .select("id, dedupe_key, kind, assigned_to, severity, title, score, signals, explanation, suggested_actions")
      .in("status", ["open", "acknowledged"]);
    const openByKey = new Map((openRows ?? []).map((r) => [r.dedupe_key, r]));
    let created = 0; let updated = 0;
    const newByAssignee = new Map<string, number>();
    for (const f of findings) {
      const existing = openByKey.get(f.dedupe_key);
      const row = { ...f, run_id: run.id, updated_at: new Date().toISOString() };
      if (existing) {
        // Only save when something changed, so open screens don't refresh for nothing.
        const same = stableJson([existing.severity, existing.title, existing.score ?? null, existing.signals, existing.explanation, existing.suggested_actions, existing.assigned_to])
          === stableJson([f.severity, f.title, f.score ?? null, f.signals, f.explanation, f.suggested_actions, f.assigned_to ?? null]);
        if (!same) {
          await admin.from("agent_findings").update(row).eq("id", existing.id);
          updated++;
        }
      } else {
        const { error } = await admin.from("agent_findings").insert(row);
        if (error) throw error;
        created++;
        if (f.assigned_to) newByAssignee.set(f.assigned_to, (newByAssignee.get(f.assigned_to) ?? 0) + 1);
      }
    }

    // Learners no longer flagged, and registers/marks now done: close automatically.
    for (const r of openRows ?? []) {
      if (r.kind === "at_risk" && !flaggedKeys.has(r.dedupe_key)) resolvedKeys.push(r.dedupe_key);
    }
    let resolved = 0;
    for (const key of new Set(resolvedKeys)) {
      const existing = openByKey.get(key);
      if (!existing) continue;
      await admin.from("agent_findings").update({
        status: "actioned", reviewed_at: new Date().toISOString(), review_note: "Closed by the agent: no longer applies.", updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      resolved++;
    }

    // Tell each assigned staff member once per run.
    for (const [uid, n] of newByAssignee) {
      await admin.from("notifications").insert({
        user_id: uid, type: "info", link: "/portal/teacher",
        title: "School agent: new items to review",
        message: `${n} new item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} your review (learners needing support, registers or marks).`,
      });
    }

    const count = (k: Finding["kind"]) => findings.filter((f) => f.kind === k).length;
    const summary = {
      learners_checked: (signals ?? []).length,
      at_risk: count("at_risk"), attendance_not_taken: count("attendance_not_taken"),
      marks_overdue: count("marks_overdue"), fee_arrears: count("fee_arrears"),
      created, updated, resolved, ai_explanations: aiUsed,
    };
    await admin.from("agent_runs").update({
      status: "completed", finished_at: new Date().toISOString(), summary, model: aiUsed ? MODEL : null,
    }).eq("id", run.id);
    return json({ ok: true, run_id: run.id, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("agent_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    return json({ error: message }, 500);
  }
});
