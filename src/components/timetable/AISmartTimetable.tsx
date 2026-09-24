import { useMemo, useState } from "react";
import { useAllocation, DAYS, TimetableSlot } from "@/contexts/AllocationContext";
import TimetableGrid from "@/components/allocation/TimetableGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, AlertTriangle, CheckCircle2, Bell, Pencil, Clock, MapPin, User, BookOpen, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AI Smart Timetable - admin master view.
 * - Run the AI agent to generate / re-generate the full week.
 * - Click any cell to edit subject / teacher / venue / time.
 * - Live conflict detector with suggested resolutions.
 * - Notification feed of every change.
 * Changes here propagate instantly to student & teacher portals (shared context).
 */
export default function AISmartTimetable() {
  const {
    classes, slots, subjects, teachers, rooms, periodSchedule,
    conflicts, notifications, runAIAgent, updateSlot,
  } = useAllocation();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? "");
  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [draft, setDraft] = useState<Partial<TimetableSlot>>({});
  const [running, setRunning] = useState(false);

  const classConflicts = useMemo(
    () => conflicts.filter((c) => c.slotIds.some((id) => slots.find((s) => s.id === id)?.classId === selectedClassId)),
    [conflicts, slots, selectedClassId],
  );

  const totalSlots = slots.filter((s) => s.subjectId).length;
  const errors = conflicts.filter((c) => c.severity === "error").length;

  const handleRunAI = async () => {
    setRunning(true);
    // small artificial delay so the user sees the agent "thinking"
    await new Promise((r) => setTimeout(r, 700));
    const res = runAIAgent();
    setRunning(false);
    toast({
      title: "AI Agent finished",
      description: `${res.placed} periods placed${res.warnings.length ? ` • ${res.warnings.length} warning(s)` : ""}.`,
    });
  };

  const openEditor = (slot: TimetableSlot) => {
    setEditing(slot);
    setDraft({
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      roomId: slot.roomId,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  };

  const saveEditor = () => {
    if (!editing) return;
    if (!draft.subjectId || !draft.teacherId || !draft.roomId || !draft.startTime || !draft.endTime) {
      toast({
        variant: "destructive",
        title: "All four fields required",
        description: "Subject, Teacher, Venue, and Time must all be filled. No blank slots allowed.",
      });
      return;
    }
    updateSlot(editing.id, draft);
    setEditing(null);
    toast({ title: "Slot updated", description: "All portals updated instantly." });
  };

  // editable per-class grid (click cells)
  const slotsForClass = slots.filter((s) => s.classId === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="font-heading text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Smart Timetable
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              The AI agent generates and validates the master timetable. Every slot shows
              <strong> subject · teacher · venue · exact time</strong>. Changes sync instantly to
              the Student, Teacher and Parent portals.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {totalSlots} periods placed</Badge>
            <Badge variant={errors > 0 ? "destructive" : "outline"} className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {errors} conflicts
            </Badge>
            <Button onClick={handleRunAI} disabled={running} className="gap-2">
              <Wand2 className={cn("h-4 w-4", running && "animate-pulse")} />
              {running ? "AI is generating…" : "Run AI Agent"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Grid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">Master Timetable</CardTitle>
              <CardDescription>Click any cell to edit. Days × Periods.</CardDescription>
            </div>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableGrid
              slots={slotsForClass}
              periods={periodSchedule}
              onEdit={openEditor}
            />
            {/* Read-only mirror so admin sees exactly what students see */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Live preview. This is exactly what students of {classes.find((c) => c.id === selectedClassId)?.name} see in their portal:
              </p>
              <TimetableGrid classId={selectedClassId} highlightToday />
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: conflicts + notifications */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Conflicts
              </CardTitle>
              <CardDescription className="text-xs">
                {conflicts.length === 0 ? "No conflicts detected." : `${conflicts.length} issue(s), ${classConflicts.length} in current class.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] pr-3">
                {conflicts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    Timetable is fully valid.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {conflicts.map((c) => (
                      <li key={c.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {labelFor(c.type)}
                        </div>
                        <div className="mt-1 text-foreground/90">{c.description}</div>
                        <div className="mt-1 text-muted-foreground">
                          <span className="font-medium text-foreground/80">Suggested fix:</span> {c.suggestion}
                        </div>
                        {c.slotIds[0] && (
                          <Button
                            size="sm" variant="outline" className="mt-2 h-7 text-xs"
                            onClick={() => {
                              const s = slots.find((x) => x.id === c.slotIds[0]);
                              if (s) { setSelectedClassId(s.classId); openEditor(s); }
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Change notifications
              </CardTitle>
              <CardDescription className="text-xs">Live feed: broadcast to affected teachers & students.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[240px] pr-3">
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li key={n.id} className="rounded-md border bg-card p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{n.kind.replace("_", " ")}</span>
                        <span className="text-muted-foreground tabular-nums">{new Date(n.at).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-1">{n.message}</div>
                      {(n.subjectName || n.teacherName || n.roomName || n.startTime) && (
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          {n.subjectName && <span className="inline-flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" />{n.subjectName}</span>}
                          {n.teacherName && <span className="inline-flex items-center gap-1"><User className="h-2.5 w-2.5" />{n.teacherName}</span>}
                          {n.roomName && <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{n.roomName}</span>}
                          {n.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{n.startTime}–{n.endTime}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                  {notifications.length === 0 && <li className="text-xs text-muted-foreground py-4 text-center">No changes yet.</li>}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit slot: {DAYS[editing?.day ?? 0]} P{editing?.period}</DialogTitle>
            <DialogDescription>All four fields are required. Saving notifies the teacher and the class instantly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Select value={draft.subjectId ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, subjectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={draft.teacherId ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, teacherId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick teacher" /></SelectTrigger>
                <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Venue</Label>
              <Select value={draft.roomId ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick venue" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => {
                    const subj = subjects.find((s) => s.id === draft.subjectId);
                    const ok = !subj || subj.allowedRoomTypes.includes(r.type);
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.type}) {!ok && "⚠"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start</Label>
                <Input type="time" value={draft.startTime ?? ""} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="time" value={draft.endTime ?? ""} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEditor}>Save & broadcast</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function labelFor(t: string) {
  switch (t) {
    case "teacher_double": return "Teacher double-booked";
    case "room_double": return "Room double-booked";
    case "missing_field": return "Missing field";
    case "wrong_room_type": return "Wrong venue type";
    default: return t;
  }
}

function EditableGrid({
  slots, periods, onEdit,
}: {
  slots: TimetableSlot[];
  periods: { period: number; start: string; end: string }[];
  onEdit: (s: TimetableSlot) => void;
}) {
  const { subjects, teachers, rooms } = useAllocation();
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted">
            <th className="border-b px-3 py-2 text-left">Period</th>
            {DAYS.map((d) => <th key={d} className="border-b border-l px-3 py-2 text-center">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.period} className="align-top">
              <td className="border-t px-3 py-2 font-medium whitespace-nowrap">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" />P{p.period}</div>
                <div className="text-[10px] text-muted-foreground">{p.start}–{p.end}</div>
              </td>
              {DAYS.map((_, di) => {
                const s = slots.find((x) => x.day === di && x.period === p.period);
                if (!s) return <td key={di} className="border-t border-l p-1.5 min-w-[140px]" />;
                const subj = subjects.find((x) => x.id === s.subjectId);
                const teacher = teachers.find((x) => x.id === s.teacherId);
                const room = rooms.find((x) => x.id === s.roomId);
                const filled = subj && teacher && room;
                return (
                  <td key={di} className="border-t border-l p-1.5 min-w-[140px]">
                    <button
                      onClick={() => onEdit(s)}
                      className={cn(
                        "w-full text-left rounded-md p-2 border-l-4 transition hover:shadow-sm",
                        filled ? "bg-card" : "border-dashed border-muted-foreground/30 bg-muted/30",
                      )}
                      style={filled ? { borderLeftColor: subj!.color } : undefined}
                    >
                      {filled ? (
                        <>
                          <div className="font-semibold truncate flex items-center gap-1">
                            <BookOpen className="h-3 w-3" style={{ color: subj!.color }} />
                            {subj!.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <User className="h-3 w-3" />{teacher!.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{room!.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground/80 tabular-nums">{s.startTime}–{s.endTime}</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-muted-foreground text-center py-2">+ Assign</div>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
