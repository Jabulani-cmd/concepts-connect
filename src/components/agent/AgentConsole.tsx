import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Clock, Database, Loader2, Play, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { AGENT_INTERVAL_MINUTES, getScheduleStatus, loadDemoActivity, runAgent, type AgentRun } from "@/lib/agent";
import AgentFindingsPanel from "./AgentFindingsPanel";

const INTERVAL_MS = AGENT_INTERVAL_MINUTES * 60 * 1000;

/**
 * Admin view of the school monitoring agent: run it, see its history and the rules it
 * uses, and review everything it has found. The database runs the agent every 15
 * minutes; if that schedule isn't active, this page keeps it running while it's open.
 */
export default function AgentConsole() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduled, setScheduled] = useState<boolean | null>(null);
  const runningRef = useRef(false);

  const loadRuns = useCallback(async () => {
    const { data } = await supabase.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(10);
    setRuns((data ?? []) as AgentRun[]);
    return (data ?? []) as AgentRun[];
  }, []);

  const run = useCallback(async (trigger: "manual" | "auto") => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      const res = await runAgent(trigger);
      if (res.already_running) toast({ title: "The agent is already running", description: "Results will appear in a moment." });
      else if (trigger === "manual" && res.summary) {
        const s = res.summary;
        toast({ title: "Agent run complete", description: `${s.at_risk} learners to support, ${s.attendance_not_taken} registers, ${s.marks_overdue} marks overdue, ${s.fee_arrears ? "fee arrears summary" : "no fee arrears"}.` });
      }
    } catch (e) {
      if (trigger === "manual") toast({ title: "The agent could not run", description: errorMessage(e), variant: "destructive" });
    }
    await loadRuns();
    setRefreshKey((k) => k + 1);
    runningRef.current = false;
    setRunning(false);
  }, [loadRuns, toast]);

  useEffect(() => {
    getScheduleStatus().then((s) => setScheduled(s.scheduled));
  }, []);

  // Keep the agent running: if the last run is older than the interval (e.g. the database
  // schedule isn't active), run it now and then every interval while this page is open.
  useEffect(() => {
    const tick = async () => {
      const list = await loadRuns();
      const lastStart = list[0] ? new Date(list[0].started_at).getTime() : 0;
      if (Date.now() - lastStart > INTERVAL_MS + 60_000) run("auto");
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [loadRuns, run]);

  // Live run history.
  useEffect(() => {
    const channel = supabase
      .channel(`agent-runs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => { loadRuns(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRuns]);

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await loadDemoActivity();
      toast({ title: "Demo activity loaded", description: `${r.attendance} attendance records, ${r.marks} marks, ${r.homework} homework tasks. Running the agent…` });
      await run("manual");
    } catch (e) {
      toast({ title: "Could not load demo activity", description: errorMessage(e), variant: "destructive" });
    }
    setSeeding(false);
  };

  const last = runs[0];
  const lastDone = runs.find((r) => r.status === "completed");
  const nextRun = lastDone ? new Date(new Date(lastDone.started_at).getTime() + INTERVAL_MS) : null;

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading text-xl"><Bot className="h-6 w-6 text-primary" /> School Monitoring Agent</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Checks the school's records every day and tells the right staff what needs attention: learners whose attendance,
              marks or homework have slipped; registers not taken; marks not entered; and overdue fees. Class teachers,
              HODs and office staff see their items in their own portals.
            </CardDescription>
            <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${scheduled === false ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>
              <Clock className="h-3.5 w-3.5" />
              {scheduled === false
                ? `Automatic schedule not active yet: running every ${AGENT_INTERVAL_MINUTES} minutes while this page is open`
                : `Runs automatically every ${AGENT_INTERVAL_MINUTES} minutes, day and night`}
              {lastDone && ` · last run ${new Date(lastDone.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
              {nextRun && nextRun.getTime() > Date.now() && ` · next about ${nextRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("manual")} disabled={running}>
              {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />} Run now
            </Button>
            <Button variant="outline" onClick={seed} disabled={seeding || running} title="Eight weeks of attendance, marks and homework for the demo school">
              {seeding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Database className="mr-1 h-4 w-4" />} Load demo activity
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">
            <p className="mb-2 font-medium">How learners are flagged</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Attendance down more than 20 points in the last four weeks: +2</li>
              <li>Marks down more than 10 points in two or more subjects: +2</li>
              <li>More than 30% of homework not handed in: +1</li>
              <li>Flagged at 2 points; high priority at 4 or more.</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Thresholds follow the Ministry proposal and should be approved and checked for fairness before real use.</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="mb-2 flex items-center gap-1 font-medium"><ShieldCheck className="h-4 w-4 text-green-600" /> Responsible AI</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Rules decide who is flagged; AI only writes the explanation and next steps.</li>
              <li>No names or ID numbers are sent to the AI, only form and the numbers behind the flag.</li>
              <li>No disciplinary action and nothing sent to families automatically.</li>
              <li>Every item is reviewed by staff; "Not correct" needs a reason, and every run is logged.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AgentFindingsPanel title="All items" refreshKey={refreshKey} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recent runs</CardTitle>
          <CardDescription>
            {last ? `Last run ${new Date(last.started_at).toLocaleString("en-GB")} (${last.status}).` : "The agent has not run yet."}
            {" "}The agent runs every {AGENT_INTERVAL_MINUTES} minutes; items close by themselves once they no longer apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Learners checked</TableHead>
                <TableHead>Found</TableHead>
                <TableHead>AI explanations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No runs yet.</TableCell></TableRow>
              ) : runs.map((r) => {
                const s = (r.summary ?? {}) as Record<string, number | boolean>;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.started_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                    <TableCell className="capitalize">{r.trigger}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
                      {r.error && <p className="mt-1 max-w-xs text-xs text-destructive">{r.error}</p>}
                    </TableCell>
                    <TableCell>{String(s.learners_checked ?? "-")}</TableCell>
                    <TableCell className="text-sm">
                      {r.status === "completed"
                        ? `${s.at_risk ?? 0} learners · ${s.attendance_not_taken ?? 0} registers · ${s.marks_overdue ?? 0} marks · ${s.fee_arrears ? "fees" : "no fees"} (${s.created ?? 0} new, ${s.resolved ?? 0} closed)`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">{r.model ?? (r.status === "completed" ? "Rules only" : "-")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
