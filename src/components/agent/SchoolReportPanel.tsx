import { useEffect, useState } from "react";
import { AlertTriangle, Award, CalendarX, FileBarChart, Printer, Sparkles, TrendingDown, UserX, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { buildBrandedHtml } from "@/lib/print/printSection";
import type { DailyReport } from "../../../supabase/functions/school-agent/alerts";

type Row = { report_date: string; data: DailyReport; summary: string | null; summary_source: string; updated_at: string };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const money = (n: number) => `US$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function List<T>({ title, icon: Icon, items, empty, render }: { title: string; icon: typeof Users; items: T[]; empty: string; render: (x: T) => React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {title} <span className="font-normal text-muted-foreground">({items.length})</span></p>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : (
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">{items.map((x, i) => <li key={i} className="flex justify-between gap-2 border-b border-dashed pb-1 last:border-0">{render(x)}</li>)}</ul>
      )}
    </div>
  );
}

/**
 * The agent's daily school report for the principal and administrators: attendance,
 * learners needing support and excelling, teachers away and cover, and overdue fees.
 */
export default function SchoolReportPanel({ compact = false, onOpenFull }: { compact?: boolean; onOpenFull?: () => void }) {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string>("");
  const [row, setRow] = useState<Row | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  useEffect(() => {
    const loadDates = async () => {
      const { data, error } = await supabase.from("agent_reports").select("report_date").order("report_date", { ascending: false }).limit(30);
      if (error) { setMissingTable(true); return; }
      const list = (data ?? []).map((d) => d.report_date);
      setDates(list);
      setDate((cur) => cur || list[0] || "");
    };
    loadDates();
    const ch = supabase.channel(`agent-reports-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_reports" }, () => { loadDates(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!date) return;
    supabase.from("agent_reports").select("report_date, data, summary, summary_source, updated_at").eq("report_date", date).maybeSingle()
      .then(({ data }) => setRow((data as unknown as Row) ?? null));
  }, [date, dates]);

  if (missingTable) {
    return compact ? null : (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">The daily school report appears here once the new agent SQL file has been run and the agent has run.</CardContent></Card>
    );
  }
  if (!row) {
    return compact ? null : (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">No school report yet. Press "Run now" on the School Monitoring Agent to create today's report.</CardContent></Card>
    );
  }

  const r = row.data;
  const tiles = [
    { label: "Present today", value: r.attendance.present_pct != null ? `${r.attendance.present_pct}%` : "–", sub: `registers ${r.attendance.registers_taken}/${r.attendance.classes}`, icon: Users },
    { label: "Absent today", value: r.attendance.absent_today, sub: `${r.attendance.chronic.length} with low attendance`, icon: CalendarX },
    { label: "Need support", value: r.performance.low.length, sub: `${r.performance.at_risk} slipping`, icon: TrendingDown },
    { label: "Excelling", value: r.performance.excellent.length, sub: r.performance.school_avg != null ? `school avg ${r.performance.school_avg}%` : "", icon: Award },
    { label: "Teachers away", value: r.teachers.away.length, sub: `${r.teachers.lessons_needing_cover} lessons need cover`, icon: UserX },
    { label: "Fees overdue", value: money(r.fees.total_usd), sub: `${r.fees.learners_owing} learners`, icon: Wallet },
  ];
  const summaryLines = (row.summary ?? "").split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);

  const print = () => {
    const table = (head: string[], rows: (string | number)[][]) =>
      rows.length ? `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "<p>None.</p>";
    const html = buildBrandedHtml({
      title: "Daily School Report",
      subtitle: longDate(r.date),
      bodyHtml:
        `<h3>Summary</h3>${summaryLines.map((l) => `<p>${esc(l)}</p>`).join("")}` +
        `<h3>At a glance</h3>${table(["Measure", "Value", ""], tiles.map((t) => [t.label, String(t.value), t.sub]))}` +
        `<h3>Absent today</h3>${table(["Learner", "Class"], r.attendance.absent.map((a) => [a.name, a.class_name]))}` +
        `<h3>Low attendance (last four weeks)</h3>${table(["Learner", "Class", "Attendance"], r.attendance.chronic.map((a) => [a.name, a.class_name, `${a.attendance_pct}%`]))}` +
        `<h3>Learners needing support</h3>${table(["Learner", "Class", "Average", "Weak subjects"], r.performance.low.map((a) => [a.name, a.class_name, `${Math.round(a.avg)}%`, a.weak]))}` +
        `<h3>Excelling</h3>${table(["Learner", "Class", "Average"], r.performance.excellent.map((a) => [a.name, a.class_name, `${Math.round(a.avg)}%`]))}` +
        `<h3>Teachers away</h3>${table(["Teacher", "Reason", "Lessons", "Covered"], r.teachers.away.map((t) => [t.name, t.reason, t.lessons, t.covered]))}` +
        `<h3>Largest overdue balances</h3>${table(["Learner", "Class", "Balance"], r.fees.top_debtors.map((d) => [d.name, d.class_name, money(d.balance)]))}`,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><FileBarChart className="h-5 w-5 text-primary" /> Daily School Report</CardTitle>
          <CardDescription className="mt-1">
            {longDate(r.date)} · updated {new Date(row.updated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} by the school agent
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compact && dates.length > 1 && (
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {compact ? (
            onOpenFull && <Button variant="outline" onClick={onOpenFull}>Full report</Button>
          ) : (
            <Button variant="outline" onClick={print}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summaryLines.length > 0 && (
          <div className="rounded-lg bg-primary/5 p-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {row.summary_source.startsWith("ai:") ? "AI briefing" : "Briefing"}
            </p>
            <ul className="space-y-1">{summaryLines.map((l, i) => <li key={i} className={l.toLowerCase().startsWith("suggested focus") ? "font-medium text-primary" : ""}>{l}</li>)}</ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><t.icon className="h-3.5 w-3.5" /> {t.label}</p>
              <p className="mt-0.5 text-xl font-bold">{t.value}</p>
              {t.sub && <p className="text-[11px] text-muted-foreground">{t.sub}</p>}
            </div>
          ))}
        </div>
        {!compact && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <List title="Absent today" icon={CalendarX} items={r.attendance.absent} empty="No absences recorded yet today."
              render={(a) => <><span>{a.name}</span><span className="text-muted-foreground">{a.class_name}</span></>} />
            <List title="Low attendance (4 weeks)" icon={AlertTriangle} items={r.attendance.chronic} empty="Everyone is above 80%."
              render={(a) => <><span>{a.name} <span className="text-muted-foreground">{a.class_name}</span></span><Badge variant="outline">{a.attendance_pct}%</Badge></>} />
            <List title="Needing support" icon={TrendingDown} items={r.performance.low} empty="No learners below the support mark."
              render={(a) => <><span className="min-w-0">{a.name} <span className="text-muted-foreground">{a.class_name}{a.weak ? ` · ${a.weak}` : ""}</span></span><Badge variant="destructive">{Math.round(a.avg)}%</Badge></>} />
            <List title="Excelling" icon={Award} items={r.performance.excellent} empty="No learners above the excellence mark yet."
              render={(a) => <><span>{a.name} <span className="text-muted-foreground">{a.class_name}</span></span><Badge className="bg-green-600 hover:bg-green-600">{Math.round(a.avg)}%</Badge></>} />
            <List title="Teachers away" icon={UserX} items={r.teachers.away} empty="No teachers on leave today."
              render={(t) => <><span>{t.name} <span className="text-muted-foreground">{t.reason}</span></span><span className={t.covered < t.lessons ? "text-destructive" : "text-muted-foreground"}>{t.covered}/{t.lessons} covered</span></>} />
            <List title="Largest overdue balances" icon={Wallet} items={r.fees.top_debtors} empty="No fees more than 30 days overdue."
              render={(d) => <><span>{d.name} <span className="text-muted-foreground">{d.class_name}</span></span><span className="font-medium">{money(d.balance)}</span></>} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
