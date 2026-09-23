import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, CheckCircle2, AlertTriangle, Upload, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAllocation, DAYS } from "@/contexts/AllocationContext";
import { useToast } from "@/hooks/use-toast";

type Msg = { id: string; role: "agent" | "admin"; text: string };

const STEPS = [
  "structure",     // forms & streams
  "class_sizes",   // student counts
  "school_day",    // start, periods, breaks
  "subjects",      // per-form subjects & periods
  "teachers",      // availability
  "venues",        // room confirmations
  "review",        // generated, awaiting approval
  "published",
] as const;
type Step = typeof STEPS[number];

const stepTitle: Record<Step, string> = {
  structure: "1. School structure",
  class_sizes: "2. Class sizes",
  school_day: "3. School day",
  subjects: "4. Subject allocation",
  teachers: "5. Teacher availability",
  venues: "6. Venue confirmation",
  review: "7. Review & approve",
  published: "Published",
};

export default function AITimetableBuilderAgent() {
  const ctx = useAllocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("structure");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [approved, setApproved] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const classes = ctx.classes;
  const formGroups = useMemo(() => {
    const map = new Map<number, typeof classes>();
    classes.forEach(c => {
      const arr = map.get(c.gradeLevel) ?? [];
      arr.push(c); map.set(c.gradeLevel, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [classes]);

  function push(role: Msg["role"], text: string) {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, text }]);
  }

  function agentSay(text: string, delay = 350) {
    setThinking(true);
    setTimeout(() => { push("agent", text); setThinking(false); }, delay);
  }

  // Initial greeting
  useEffect(() => {
    if (messages.length) return;
    push("agent",
      `Hello! I'm your AI Timetable Builder. I'll walk you through six quick steps and then assemble the full weekly timetable for every class.\n\nI already have records for **${ctx.teachers.length} teachers**, **${ctx.subjects.length} subjects**, **${ctx.rooms.length} venues** and **${ctx.classes.length} classes** on file — I'll only ask you to confirm or fill what's missing.`);
    setTimeout(() => askForStep("structure"), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function askForStep(s: Step) {
    switch (s) {
      case "structure": {
        const summary = formGroups.map(([g, cs]) =>
          `• Form ${g}: ${cs.map(c => c.name).join(", ")}`).join("\n");
        agentSay(`**Step 1 — School structure.**\nFrom your records I see:\n${summary}\n\nIs this correct? Reply **yes** to confirm, or describe any missing form/stream (e.g. _"add Grade 11D"_).`);
        break;
      }
      case "class_sizes": {
        const lines = ctx.classes.map(c => `• ${c.name}: ${c.studentCount} students`).join("\n");
        agentSay(`**Step 2 — Class sizes.**\nCurrent enrolment:\n${lines}\n\nReply **yes** if accurate, or send corrections like _"Grade 9B has 34 students"_.`);
        break;
      }
      case "school_day": {
        const p = ctx.periodSchedule;
        agentSay(`**Step 3 — School day.**\nDay starts **${p[0].start}**, ends **${p[p.length - 1].end}**, **${p.length} periods** of ~40 min each, with a morning break after P3 and lunch after P6.\n\nReply **yes** to accept, or describe changes (e.g. _"start at 08:00"_, _"7 periods only"_).`);
        break;
      }
      case "subjects": {
        const lines = ctx.classes.map(c => {
          const subs = c.subjects.map(s => {
            const sn = ctx.subjects.find(x => x.id === s.subjectId)?.name;
            return `${sn} (${s.periodsPerWeek}p${s.roomType !== "Regular" ? `, ${s.roomType}` : ""})`;
          }).join(", ");
          return `• ${c.name}: ${subs}`;
        }).join("\n");
        agentSay(`**Step 4 — Subject allocation per form.**\n${lines}\n\nVenue rules already enforced: Science → Lab, ICT → Computer Room, PE → Hall/Sports Field.\nReply **yes** to confirm.`);
        break;
      }
      case "teachers": {
        const lines = ctx.teachers.map(t => {
          const subs = t.qualifiedSubjects.map(id => ctx.subjects.find(s => s.id === id)?.name).filter(Boolean).join(", ");
          return `• ${t.name} — ${t.employmentType}, max ${t.maxPeriodsPerWeek} p/wk, prefers ${t.preferredTime}, teaches ${subs}`;
        }).join("\n");
        agentSay(`**Step 5 — Teacher availability.**\n${lines}\n\nAll teachers assumed available Mon–Fri unless you specify otherwise. Reply **yes** or note restrictions (e.g. _"Mrs Khumalo unavailable Friday"_).`);
        break;
      }
      case "venues": {
        const lines = ctx.rooms.map(r => `• ${r.name} — ${r.type}, capacity ${r.capacity}`).join("\n");
        agentSay(`**Step 6 — Venues.**\n${lines}\n\nLabs reserved for Science, Computer Room for ICT, Hall/Sports Field for PE. Reply **yes** to confirm and I'll generate the timetable.`);
        break;
      }
      case "review": {
        runGeneration();
        break;
      }
      default: break;
    }
  }

  function advance() {
    const idx = STEPS.indexOf(step);
    const next = STEPS[idx + 1];
    setStep(next);
    askForStep(next);
  }

  function runGeneration() {
    agentSay(`Generating the master timetable now — solving for teacher conflicts, room capacity and subject-venue rules…`, 200);
    setTimeout(() => {
      const res = ctx.runAIAgent();
      let msg = `✅ **Timetable generated.** ${res.placed} periods placed across ${ctx.classes.length} classes.\n`;
      if (res.warnings.length) {
        msg += `\n⚠️ Unfilled slots resolved as warnings:\n${res.warnings.slice(0, 6).map(w => `• ${w}`).join("\n")}`;
      } else {
        msg += `\nNo unfilled slots.`;
      }
      msg += `\n\nReview the grid below. Send corrections in plain text — for example:\n• _"Move Grade 10C Mathematics to Wednesday Period 3"_\n• _"Replace Mr. Zulu with Mrs. Khumalo for all Friday slots"_\n\nWhen you're happy, click **Approve & Publish**.`;
      push("agent", msg);
      setThinking(false);
    }, 1400);
  }

  // ---------- Plain-text correction parser ----------
  function findClass(text: string) {
    return ctx.classes.find(c => text.toLowerCase().includes(c.name.toLowerCase()));
  }
  function findSubject(text: string) {
    return ctx.subjects.find(s => text.toLowerCase().includes(s.name.toLowerCase()));
  }
  function findTeacher(text: string) {
    const lower = text.toLowerCase();
    return ctx.teachers.find(t => {
      const surname = t.name.split(/\s+/).slice(-1)[0].toLowerCase();
      return lower.includes(surname);
    });
  }
  function findDay(text: string) {
    const map = ["monday","tuesday","wednesday","thursday","friday"];
    const lower = text.toLowerCase();
    return map.findIndex(d => lower.includes(d));
  }

  function applyCorrection(text: string): string {
    const t = text.toLowerCase();

    // Pattern: replace X with Y for all <day> slots / for <class>
    if (/replace .* with /.test(t)) {
      const parts = text.match(/replace\s+(.+?)\s+with\s+(.+?)(?:\s+for\s+(.+))?$/i);
      if (parts) {
        const fromT = findTeacher(parts[1]);
        const toT = findTeacher(parts[2]);
        const scope = parts[3] ?? "";
        if (!fromT || !toT) return `I couldn't match the teacher names. Try using surnames I have on file.`;
        const day = findDay(scope);
        const cls = findClass(scope);
        let count = 0;
        ctx.slots.forEach(s => {
          if (s.teacherId !== fromT.id) return;
          if (day >= 0 && s.day !== day) return;
          if (cls && s.classId !== cls.id) return;
          ctx.updateSlot(s.id, { teacherId: toT.id });
          count++;
        });
        return count
          ? `Done — substituted **${fromT.name} → ${toT.name}** on ${count} slot(s). Re-validating…`
          : `No matching slots found to substitute.`;
      }
    }

    // Pattern: move <class> <subject> to <day> period <n>
    const moveMatch = text.match(/move\s+(.+?)\s+to\s+(\w+)\s*period\s*(\d+)/i);
    if (moveMatch) {
      const cls = findClass(moveMatch[1]);
      const subj = findSubject(moveMatch[1]);
      const day = findDay(moveMatch[2]);
      const period = parseInt(moveMatch[3], 10);
      if (!cls || !subj || day < 0) return `I couldn't parse class/subject/day. Try: _"Move Grade 10C Mathematics to Wednesday Period 3"_.`;
      const target = ctx.slots.find(s => s.classId === cls.id && s.day === day && s.period === period);
      const source = ctx.slots.find(s => s.classId === cls.id && s.subjectId === subj.id);
      if (!target || !source) return `Couldn't find a matching slot to move.`;
      // swap
      ctx.updateSlot(target.id, { subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId });
      ctx.updateSlot(source.id, { subjectId: target.subjectId, teacherId: target.teacherId, roomId: target.roomId });
      return `Moved **${subj.name}** for ${cls.name} to ${DAYS[day]} P${period}. Re-validating…`;
    }

    return "";
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    push("admin", text);
    setDraft("");
    const t = text.toLowerCase();

    // Review-mode corrections
    if (step === "review") {
      const result = applyCorrection(text);
      if (result) {
        agentSay(result);
        setTimeout(() => {
          const c = ctx.conflicts.length;
          agentSay(c
            ? `Validation complete — **${c} conflict(s)** remain. See the conflicts panel for resolution suggestions.`
            : `Validation passed — **no conflicts**. Ready to publish when you are.`);
        }, 600);
      } else if (/(approve|publish|looks good|ship it)/.test(t)) {
        handlePublish();
      } else {
        agentSay(`I didn't recognise that as a correction. Try patterns like _"Move <class> <subject> to <day> Period <n>"_ or _"Replace <teacher> with <teacher> for all <day> slots"_. Or click **Approve & Publish**.`);
      }
      return;
    }

    // Wizard steps
    if (/^(y|yes|ok|confirm|correct|looks good)/.test(t)) {
      advance();
    } else if (step === "structure" || step === "class_sizes" || step === "school_day"
            || step === "subjects" || step === "teachers" || step === "venues") {
      agentSay(`Noted — I've recorded your input ("${text.slice(0, 80)}"). Moving to the next step.`);
      setTimeout(() => advance(), 500);
    }
  }

  function handlePublish() {
    setApproved(true);
    ctx.publishTimetable();
    setStep("published");
    push("agent",
      `🎉 **Published.** The timetable is now live on:\n• **Student portal** — each student sees only their class.\n• **Teacher portal** — each teacher sees only their assigned classes.\n• **Admin portal** — full master view with edit access.\n\nAny further changes you approve through me will sync automatically.`);
    toast({ title: "Timetable published", description: "Synced to student, teacher and admin portals." });
  }

  function handleReset() {
    setMessages([]);
    setStep("structure");
    setApproved(false);
    setTimeout(() => {
      push("agent", `Restarting the interview. Let's begin again.`);
      setTimeout(() => askForStep("structure"), 400);
    }, 100);
  }

  const stepIdx = STEPS.indexOf(step);

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50/60 via-background to-fuchsia-50/40 dark:from-purple-950/30 dark:to-fuchsia-950/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-heading flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            Conversational AI Timetable Builder
            <Badge variant="outline" className="ml-2 border-purple-300 text-purple-700 dark:text-purple-300">Agent</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            I interview you step-by-step, then assemble the full weekly timetable for every form and class.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-1" />Restart</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step progress */}
        <div className="flex flex-wrap gap-1.5">
          {STEPS.slice(0, 7).map((s, i) => (
            <Badge key={s}
              variant={i < stepIdx ? "default" : i === stepIdx ? "secondary" : "outline"}
              className={i < stepIdx ? "bg-green-600 hover:bg-green-700" : ""}>
              {i < stepIdx && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {stepTitle[s]}
            </Badge>
          ))}
        </div>

        {/* Chat window */}
        <div ref={scroller} className="h-[420px] overflow-y-auto rounded-lg border bg-background/80 backdrop-blur p-4 space-y-3">
          {messages.map(m => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "admin" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed
                ${m.role === "admin"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm border"}`}>
                {m.role === "agent" && (
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-purple-600 dark:text-purple-300">
                    <Sparkles className="h-3 w-3" /> AI Agent
                  </div>
                )}
                {renderMarkdownLite(m.text)}
              </div>
            </motion.div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5 animate-pulse" /> Agent is thinking…
            </div>
          )}
        </div>

        {/* Conflict summary on review */}
        {step === "review" && ctx.conflicts.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200 text-sm mb-2">
              <AlertTriangle className="h-4 w-4" /> {ctx.conflicts.length} conflict(s) detected
            </div>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {ctx.conflicts.slice(0, 8).map(c => (
                <li key={c.id}>• <span className="font-medium">{c.description}</span> <span className="text-muted-foreground">→ {c.suggestion}</span></li>
              ))}
            </ul>
          </div>
        )}

        {/* Input row */}
        {step !== "published" && (
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder={step === "review"
                ? `Send a correction or type "approve" to publish…`
                : `Type "yes" to confirm, or describe changes…`}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!draft.trim()}>
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
        )}

        {/* Publish button on review */}
        {step === "review" && !approved && (
          <Button onClick={handlePublish} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90">
            <Upload className="h-4 w-4 mr-2" /> Approve & Publish Timetable
          </Button>
        )}

        {step === "published" && (
          <div className="rounded-lg border-2 border-green-500/40 bg-green-50 dark:bg-green-950/30 p-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span><strong>Published</strong> at {new Date(ctx.publishedAt!).toLocaleString()} — live across student, teacher and admin portals.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Tiny markdown: **bold** and _italic_ and line breaks
function renderMarkdownLite(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
    parts.push(
      <span key={`l-${li}`}>
        {tokens.map((tok, ti) => {
          if (/^\*\*[^*]+\*\*$/.test(tok)) return <strong key={ti}>{tok.slice(2, -2)}</strong>;
          if (/^_[^_]+_$/.test(tok)) return <em key={ti}>{tok.slice(1, -1)}</em>;
          return <span key={ti}>{tok}</span>;
        })}
      </span>,
    );
    if (li < lines.length - 1) parts.push(<br key={`br-${li}`} />);
  });
  return parts;
}
