import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Bot, CheckCircle2, ClipboardX, Eye, Loader2, RefreshCw, Wallet, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { FINDING_SELECT, KIND_LABELS, STATUS_LABELS, reviewFinding, type AgentFinding, type FindingStatus } from "@/lib/agent";

type Props = {
  title?: string;
  description?: string;
  /** Only these kinds of finding. */
  kinds?: string[];
  /** Bump to reload (e.g. after the agent runs). */
  refreshKey?: number;
};

const KIND_ICON: Record<string, typeof AlertTriangle> = {
  at_risk: AlertTriangle,
  attendance_not_taken: ClipboardX,
  marks_overdue: ClipboardX,
  fee_arrears: Wallet,
};
const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};
const OPEN = ["open", "acknowledged"];
const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<string, number> = { at_risk: 0, marks_overdue: 1, fee_arrears: 2, attendance_not_taken: 3 };

/**
 * Findings from the school monitoring agent that this user may see (the database decides:
 * leaders and HODs see all; teachers see their learners and classes; office staff see fee
 * summaries). Staff review each one; nothing happens automatically.
 */
export default function AgentFindingsPanel({ title = "School agent: items to review", description, kinds, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AgentFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "closed">("open");
  const [kindFilter, setKindFilter] = useState("all");
  const [reviewing, setReviewing] = useState<{ finding: AgentFinding; status: FindingStatus } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("agent_findings").select(FINDING_SELECT).order("updated_at", { ascending: false }).limit(500);
    if (kinds?.length) q = q.in("kind", kinds);
    const { data, error } = await q;
    if (error) toast({ title: "Could not load agent findings", description: error.message, variant: "destructive" });
    setRows((data ?? []) as AgentFinding[]);
    setLoading(false);
  }, [kinds, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Live updates: reload shortly after the agent (or a colleague) changes an item.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`agent-findings-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_findings" }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 1500);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const shown = useMemo(() => rows
    .filter((r) => (view === "open" ? OPEN.includes(r.status) : !OPEN.includes(r.status)))
    .filter((r) => kindFilter === "all" || r.kind === kindFilter)
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) || (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9)), [rows, view, kindFilter]);

  const openCount = rows.filter((r) => OPEN.includes(r.status)).length;
  const kindsPresent = [...new Set(rows.map((r) => r.kind))];

  const quick = async (f: AgentFinding, status: FindingStatus) => {
    try {
      await reviewFinding(f.id, status);
      setRows((prev) => prev.map((r) => (r.id === f.id ? { ...r, status } : r)));
    } catch (e) {
      toast({ title: "Could not update", description: errorMessage(e), variant: "destructive" });
    }
  };

  const saveReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      await reviewFinding(reviewing.finding.id, reviewing.status, note);
      setRows((prev) => prev.map((r) => (r.id === reviewing.finding.id ? { ...r, status: reviewing.status, review_note: note || r.review_note } : r)));
      setReviewing(null);
      toast({ title: reviewing.status === "dismissed" ? "Dismissed" : "Marked as done" });
    } catch (e) {
      toast({ title: "Could not save", description: errorMessage(e), variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Bot className="h-5 w-5 text-primary" /> {title}
            {openCount > 0 && <Badge className="bg-primary">{openCount}</Badge>}
          </CardTitle>
          <CardDescription>
            {description ?? "Raised by the school agent from attendance, marks, homework and fees. Please review each item; nothing is sent to families or acted on automatically."}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            {(["open", "closed"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`rounded px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v === "open" ? "To review" : "Reviewed"}
              </button>
            ))}
          </div>
          {kindsPresent.length > 1 && (
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {kindsPresent.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k] ?? k}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {view === "open" ? "Nothing to review right now." : "No reviewed items yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {shown.map((f) => {
              const Icon = KIND_ICON[f.kind] ?? AlertTriangle;
              const actions = Array.isArray(f.suggested_actions) ? (f.suggested_actions as string[]) : [];
              return (
                <div key={f.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">
                          {f.students?.full_name ? `${f.students.full_name} · ` : ""}{f.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABELS[f.kind] ?? f.kind}
                          {f.students?.admission_number ? ` · ${f.students.admission_number}` : ""}
                          {` · ${new Date(f.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={SEVERITY_STYLE[f.severity] ?? ""}>{f.severity === "high" ? "High priority" : f.severity === "medium" ? "Medium" : "Low"}</Badge>
                      <Badge variant="outline">{STATUS_LABELS[f.status] ?? f.status}</Badge>
                    </div>
                  </div>
                  {f.explanation && <p className="mt-2 text-sm">{f.explanation}</p>}
                  {actions.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {actions.map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {f.explanation_source.startsWith("ai:") ? "Flagged by school rules; explanation drafted by AI. Please check before acting." : "Flagged by school rules."}
                    {f.review_note ? ` Note: ${f.review_note}` : ""}
                  </p>
                  {OPEN.includes(f.status) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {f.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => quick(f, "acknowledged")}><Eye className="mr-1 h-3.5 w-3.5" /> Seen</Button>
                      )}
                      <Button size="sm" onClick={() => { setNote(""); setReviewing({ finding: f, status: "actioned" }); }}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Done
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setNote(""); setReviewing({ finding: f, status: "dismissed" }); }}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Not correct
                      </Button>
                    </div>
                  )}
                  {!OPEN.includes(f.status) && (
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => quick(f, "open")}>Reopen</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewing?.status === "dismissed" ? "Not correct" : "Mark as done"}</DialogTitle>
            <DialogDescription>
              {reviewing?.status === "dismissed"
                ? "Say why this item is wrong or doesn't apply. This helps check the rules are fair."
                : "Add a short note on what was done (optional), e.g. \"Spoke to learner and called parent\"."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={reviewing?.status === "dismissed" ? "Reason (required)" : "Note"} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveReview} disabled={saving || (reviewing?.status === "dismissed" && !note.trim())}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
