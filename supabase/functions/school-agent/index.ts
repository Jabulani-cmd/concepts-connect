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
import {
  DEFAULT_ALERT_SETTINGS, alertKey, classify, parentAbsent, parentExcellent, parentSupport, reportCounts, ruleSummary,
  studentExcellent, studentSupport, type AlertSettings, type DailyReport, type Message, type Performance,
} from "./alerts.ts";

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
  kind: "at_risk" | "attendance_not_taken" | "marks_overdue" | "fee_arrears" | "low_performance" | "teacher_absent";
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

/** A short briefing for the principal, written by AI from school-wide numbers only. */
async function summariseWithAi(counts: Record<string, unknown>): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const system =
    "You write the daily briefing for the principal of a Zimbabwean secondary school. From the numbers given, write 3 to 5 short " +
    "lines on what matters today (attendance, learners needing support, teachers away and cover, fees), then one line starting " +
    "'Suggested focus:' with the two most useful actions. Be factual and calm, quote the numbers, no names, no headings, " +
    "no bullet characters, one point per line." + NO_EM_DASH;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(counts) }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return text.trim() ? noEmDash(text.trim()) : null;
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

    // ---------- 5. Learners performing poorly (not only those slipping) ----------
    const { data: settingsRow } = await admin.from("agent_settings").select("notify_parents, notify_students, low_mark, excellent_mark").eq("id", 1).maybeSingle();
    const settings: AlertSettings = { ...DEFAULT_ALERT_SETTINGS, ...(settingsRow ?? {}) } as AlertSettings;
    settings.low_mark = Number(settings.low_mark); settings.excellent_mark = Number(settings.excellent_mark);
    const { data: perfRows, error: perfErr } = await admin.rpc("agent_student_performance", { _days: 28 });
    // Older databases without the function still get everything else.
    const performance = (perfErr ? [] : (perfRows ?? [])) as Performance[];
    for (const p of performance) {
      p.recent_avg = p.recent_avg == null ? null : Number(p.recent_avg);
      p.attendance_pct = p.attendance_pct == null ? null : Number(p.attendance_pct);
      p.subjects = (p.subjects ?? []).map((x) => ({ ...x, avg: Number(x.avg) }));
    }
    const lowKeys = new Set<string>();
    for (const p of performance) {
      const c = classify(p, settings);
      if (!c.low || flaggedKeys.has(`risk:${p.student_id}`)) continue;
      const key = `low:${p.student_id}`;
      lowKeys.add(key);
      findings.push({
        kind: "low_performance",
        severity: (p.recent_avg ?? 100) < 30 ? "high" : "medium",
        title: `Low marks (${p.class_name})`,
        dedupe_key: key,
        student_id: p.student_id,
        class_id: p.class_id,
        assigned_to: classTeacher.get(p.class_id) ?? null,
        score: Math.round(p.recent_avg ?? 0),
        signals: { recent_avg: p.recent_avg, weak_subjects: c.weak, marks: p.marks_count, attendance_pct: p.attendance_pct },
        explanation: `Average of ${Math.round(p.recent_avg ?? 0)}% over the last four weeks` +
          (c.weak.length ? `; below ${settings.low_mark}% in ${c.weak.map((w) => `${w.subject} (${Math.round(w.avg)}%)`).join(", ")}.` : "."),
        suggested_actions: [
          "Talk with the learner and the subject teachers about what is getting in the way.",
          c.weak[0] ? `Arrange extra support or a catch-up plan in ${c.weak[0].subject}.` : "Agree a short catch-up plan with a follow-up date.",
          "Share the plan with the parent or guardian.",
        ],
        explanation_source: "rules",
      });
    }

    // ---------- 6. Teachers away today ----------
    const awayToday: { name: string; reason: string; lessons: number; covered: number }[] = [];
    const awayKeys = new Set<string>();
    if (schoolDay) {
      const { data: leave } = await admin.from("leave_requests").select("staff_id, leave_type, staff:staff_id(full_name)")
        .eq("status", "approved").lte("start_date", now.date).gte("end_date", now.date);
      if (leave?.length) {
        const weekdayNum = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[now.weekday] ?? 0;
        const { data: entries } = await admin.from("timetable_entries").select("teacher_id, day_of_week, start_time, class_id");
        const zeroBased = (entries ?? []).some((e) => e.day_of_week === 0);
        const { data: covers, error: coverErr } = await admin.from("timetable_cover").select("class_id, start_time, absent_staff_id").eq("cover_date", now.date).eq("status", "assigned");
        for (const l of leave) {
          if (!l.staff_id) continue;
          const staffRef = (Array.isArray(l.staff) ? l.staff[0] : l.staff) as { full_name?: string } | null;
          const name = staffRef?.full_name ?? "A teacher";
          const lessons = (entries ?? []).filter((e) => e.teacher_id === l.staff_id && (zeroBased ? e.day_of_week + 1 : e.day_of_week) === weekdayNum);
          const covered = coverErr ? 0 : lessons.filter((e) => (covers ?? []).some((c) => c.class_id === e.class_id && String(c.start_time).slice(0, 5) === String(e.start_time).slice(0, 5))).length;
          const uncovered = lessons.length - covered;
          awayToday.push({ name, reason: `${l.leave_type} leave`, lessons: lessons.length, covered });
          const key = `away:${l.staff_id}:${now.date}`;
          awayKeys.add(key);
          findings.push({
            kind: "teacher_absent",
            severity: uncovered > 0 ? "medium" : "low",
            title: `${name} is away today (${l.leave_type} leave)`,
            dedupe_key: key,
            signals: { date: now.date, lessons: lessons.length, covered, uncovered },
            explanation: lessons.length
              ? `${name} has ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} today; ${covered} covered, ${uncovered} still need${uncovered === 1 ? "s" : ""} a substitute.`
              : `${name} is on approved leave today and has no timetabled lessons.`,
            suggested_actions: uncovered > 0 ? ["Assign cover in Timetables → Cover Agent (it suggests free teachers)."] : [],
            explanation_source: "rules",
          });
        }
      }
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
      if (r.kind === "low_performance" && !lowKeys.has(r.dedupe_key)) resolvedKeys.push(r.dedupe_key);
      if (r.kind === "teacher_absent" && !awayKeys.has(r.dedupe_key)) resolvedKeys.push(r.dedupe_key);
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

    // ---------- 7. Alerts to parents and learners ----------
    let parentAlerts = 0; let studentAlerts = 0;
    if (performance.length && (settings.notify_parents || settings.notify_students)) {
      type Pending = { key: string; kind: string; p: Performance; parent: Message; student: Message | null };
      const pending: Pending[] = [];
      for (const p of performance) {
        const c = classify(p, settings);
        if (schoolDay && now.hour >= 9 && p.absent_today) {
          pending.push({ key: alertKey("absent", p.student_id, now.date), kind: "absent", p, parent: parentAbsent(p, now.date), student: null });
        }
        if (c.low) pending.push({ key: alertKey("support", p.student_id, now.date), kind: "support", p, parent: parentSupport(p, settings), student: studentSupport(p, settings) });
        else if (c.excellent) pending.push({ key: alertKey("excellent", p.student_id, now.date), kind: "excellent", p, parent: parentExcellent(p, settings), student: studentExcellent(p, settings) });
      }
      if (pending.length) {
        const { data: sent } = await admin.from("agent_alert_log").select("dedupe_key").in("dedupe_key", pending.map((x) => x.key));
        const already = new Set((sent ?? []).map((r) => r.dedupe_key));
        const todo = pending.filter((x) => !already.has(x.key)).slice(0, 400);
        const ids = [...new Set(todo.map((x) => x.p.student_id))];
        const parentsOf = new Map<string, Set<string>>();
        const studentUser = new Map<string, string>();
        for (let i = 0; i < ids.length; i += 200) {
          const part = ids.slice(i, i + 200);
          const [a, b, st] = await Promise.all([
            admin.from("parent_students").select("parent_id, student_id").in("student_id", part),
            admin.from("parent_student_links").select("parent_id, student_id").in("student_id", part),
            admin.from("students").select("id, user_id").in("id", part),
          ]);
          for (const r of [...(a.data ?? []), ...(b.data ?? [])]) {
            if (!parentsOf.has(r.student_id)) parentsOf.set(r.student_id, new Set());
            parentsOf.get(r.student_id)!.add(r.parent_id);
          }
          for (const r of st.data ?? []) if (r.user_id) studentUser.set(r.id, r.user_id);
        }
        const notes: { user_id: string; title: string; message: string; type: string; link: string }[] = [];
        const logs: { dedupe_key: string; kind: string; student_id: string; recipients: number }[] = [];
        for (const x of todo) {
          let recipients = 0;
          if (settings.notify_parents) {
            for (const parent of parentsOf.get(x.p.student_id) ?? []) { notes.push({ user_id: parent, ...x.parent }); recipients++; parentAlerts++; }
          }
          const su = studentUser.get(x.p.student_id);
          if (settings.notify_students && x.student && su) { notes.push({ user_id: su, ...x.student }); recipients++; studentAlerts++; }
          logs.push({ dedupe_key: x.key, kind: x.kind, student_id: x.p.student_id, recipients });
        }
        for (let i = 0; i < logs.length; i += 200) await admin.from("agent_alert_log").upsert(logs.slice(i, i + 200), { onConflict: "dedupe_key", ignoreDuplicates: true });
        for (let i = 0; i < notes.length; i += 200) await admin.from("notifications").insert(notes.slice(i, i + 200));
      }
    }

    // ---------- 8. Daily school report for the principal and administrators ----------
    let reportSaved = false;
    if (!perfErr) {
      const { data: takenToday } = await admin.from("attendance").select("class_id, status").eq("date", now.date);
      const presentToday = (takenToday ?? []).filter((t) => ["present", "late"].includes(String(t.status).toLowerCase())).length;
      const withMarks = performance.filter((p) => p.recent_avg != null && p.marks_count >= 3);
      const lows = withMarks.filter((p) => classify(p, settings).low).sort((a, b) => (a.recent_avg ?? 0) - (b.recent_avg ?? 0));
      const tops = withMarks.filter((p) => classify(p, settings).excellent).sort((a, b) => (b.recent_avg ?? 0) - (a.recent_avg ?? 0));
      const chronic = performance.filter((p) => p.attendance_pct != null && p.attendance_pct < 80 && p.days_absent >= 3)
        .sort((a, b) => (a.attendance_pct ?? 0) - (b.attendance_pct ?? 0));
      const owingByStudent = new Map<string, number>();
      for (const i of owing) owingByStudent.set(i.student_id, (owingByStudent.get(i.student_id) ?? 0) + i.balance);
      const topOwing = [...owingByStudent].sort((a, b) => b[1] - a[1]).slice(0, 15);
      const perfById = new Map(performance.map((p) => [p.student_id, p]));
      const missingNames = topOwing.map(([id]) => id).filter((id) => !perfById.has(id));
      const { data: extra } = missingNames.length ? await admin.from("students").select("id, full_name, class").in("id", missingNames) : { data: [] };
      const nameOf = (id: string) => perfById.get(id)?.full_name ?? extra?.find((e) => e.id === id)?.full_name ?? "Learner";
      const classOf = (id: string) => perfById.get(id)?.class_name ?? extra?.find((e) => e.id === id)?.class ?? "";
      const { data: openNow } = await admin.from("agent_findings").select("kind").in("status", ["open", "acknowledged"]);
      const openItems: Record<string, number> = {};
      for (const f of openNow ?? []) openItems[f.kind] = (openItems[f.kind] ?? 0) + 1;

      const report: DailyReport = {
        date: now.date,
        generated_at: new Date().toISOString(),
        attendance: {
          registers_taken: new Set((takenToday ?? []).map((t) => t.class_id)).size,
          classes: classesWithLearners.size,
          present_pct: takenToday?.length ? Math.round((presentToday * 1000) / takenToday.length) / 10 : null,
          absent_today: performance.filter((p) => p.absent_today).length,
          absent: performance.filter((p) => p.absent_today).slice(0, 60).map((p) => ({ name: p.full_name, class_name: p.class_name })),
          chronic: chronic.slice(0, 25).map((p) => ({ name: p.full_name, class_name: p.class_name, attendance_pct: p.attendance_pct ?? 0 })),
        },
        performance: {
          learners_with_marks: withMarks.length,
          school_avg: withMarks.length ? Math.round((withMarks.reduce((s, p) => s + (p.recent_avg ?? 0), 0) / withMarks.length) * 10) / 10 : null,
          at_risk: flagged.length,
          low: lows.slice(0, 30).map((p) => ({ name: p.full_name, class_name: p.class_name, avg: p.recent_avg ?? 0, weak: classify(p, settings).weak.map((w) => w.subject).join(", ") })),
          excellent: tops.slice(0, 20).map((p) => ({ name: p.full_name, class_name: p.class_name, avg: p.recent_avg ?? 0 })),
        },
        teachers: { away: awayToday, lessons_needing_cover: awayToday.reduce((s, t) => s + (t.lessons - t.covered), 0) },
        fees: {
          overdue_invoices: owing.length,
          learners_owing: owingByStudent.size,
          total_usd: Math.round(owing.reduce((s, i) => s + i.balance, 0) * 100) / 100,
          top_debtors: topOwing.map(([id, bal]) => ({ name: nameOf(id), class_name: classOf(id), balance: Math.round(bal * 100) / 100 })),
        },
        open_items: openItems,
      };
      // Only ask the AI again when the day's numbers have changed.
      const counts = reportCounts(report);
      const { data: existingReport } = await admin.from("agent_reports").select("data, summary, summary_source").eq("report_date", now.date).maybeSingle();
      const prevCounts = existingReport?.data ? reportCounts(existingReport.data as DailyReport) : null;
      let summaryText = existingReport?.summary ?? null;
      let source = existingReport?.summary_source ?? "rules";
      if (!summaryText || stableJson(prevCounts) !== stableJson(counts)) {
        const ai = await summariseWithAi(counts);
        summaryText = ai ?? ruleSummary(report);
        source = ai ? `ai:${MODEL}` : "rules";
        if (ai) aiUsed = true;
      }
      const { error: repErr } = await admin.from("agent_reports").upsert(
        { report_date: now.date, data: report, summary: summaryText, summary_source: source, updated_at: new Date().toISOString() },
        { onConflict: "report_date" },
      );
      reportSaved = !repErr;

      // Tell school leaders once a day, when the morning registers are in.
      if (reportSaved && schoolDay && now.hour >= 10) {
        const key = `report:${now.date}`;
        const { data: done } = await admin.from("agent_alert_log").select("id").eq("dedupe_key", key).maybeSingle();
        if (!done) {
          const { data: leaders } = await admin.from("user_roles").select("user_id").in("role", ["admin", "principal", "deputy_principal", "admin_supervisor"]);
          const users = [...new Set((leaders ?? []).map((l) => l.user_id))];
          if (users.length) {
            await admin.from("notifications").insert(users.map((u) => ({
              user_id: u, type: "info", link: "/portal/admin",
              title: "Today's school report is ready",
              message: `${report.attendance.absent_today} learners absent, ${report.performance.low.length} needing support, ${report.teachers.away.length} teachers away, US$ ${report.fees.total_usd.toFixed(2)} fees overdue. Open AI Agent for the full report.`,
            })));
          }
          await admin.from("agent_alert_log").insert({ dedupe_key: key, kind: "report", recipients: users.length });
        }
      }
    }

    const count = (k: Finding["kind"]) => findings.filter((f) => f.kind === k).length;
    const summary = {
      learners_checked: (signals ?? []).length,
      at_risk: count("at_risk"), attendance_not_taken: count("attendance_not_taken"),
      marks_overdue: count("marks_overdue"), fee_arrears: count("fee_arrears"),
      low_performance: count("low_performance"), teacher_absent: count("teacher_absent"),
      parent_alerts: parentAlerts, student_alerts: studentAlerts, report: reportSaved,
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
