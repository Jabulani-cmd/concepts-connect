import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Save, CheckCircle2, Printer, Sparkles, Undo2, Redo2, Pencil, Trash2 } from "lucide-react";
import {
  SlotRow, PeriodTimes, BreakSpec, buildPeriodSchedule, colorForSubject,
  dayName, detectConflicts, periodsBySubject, printableTimetableHtml,
} from "@/lib/timetableUtils";

interface Props {
  definitionId: string;
  defName: string;
  schoolDays: number[];
  dayStart: string;
  periodMinutes: number;
  periodsPerDay: number;
  breaks: BreakSpec[];
  slots: SlotRow[];
  onSave: (slots: SlotRow[]) => Promise<void>;
  onPublish?: () => Promise<void>;
  onAIRegenerate?: (feedback: string) => void;
  saving?: boolean;
}

type SubjectChip = { name: string; teacher?: string; room?: string };

export default function TimetableGridBuilder({
  definitionId, defName, schoolDays, dayStart, periodMinutes, periodsPerDay,
  breaks, slots: initialSlots, onSave, onPublish, onAIRegenerate, saving,
}: Props) {
  const schedule: PeriodTimes[] = useMemo(
    () => buildPeriodSchedule(dayStart, periodMinutes, periodsPerDay, breaks),
    [dayStart, periodMinutes, periodsPerDay, breaks],
  );

  const [slots, setSlots] = useState<SlotRow[]>(initialSlots);
  const history = useRef<SlotRow[][]>([]);
  const future = useRef<SlotRow[][]>([]);
  // Only re-seed local state when switching to a different timetable definition.
  // Re-syncing on every initialSlots identity change wipes unsaved manual edits
  // whenever the parent re-fetches (e.g. after Save Draft / Publish / realtime).
  useEffect(() => {
    setSlots(initialSlots);
    history.current = [];
    future.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitionId]);

  const pushHistory = (next: SlotRow[]) => {
    history.current.push(slots);
    future.current = [];
    setSlots(next);
  };
  const undo = () => {
    const last = history.current.pop();
    if (last) { future.current.push(slots); setSlots(last); }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next) { history.current.push(slots); setSlots(next); }
  };

  // Sidebar chips
  const [chips, setChips] = useState<SubjectChip[]>([]);
  const [chipDraft, setChipDraft] = useState<SubjectChip>({ name: "", teacher: "", room: "" });
  const [selectedChip, setSelectedChip] = useState<number | null>(null);

  // Cell editing
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editValue, setEditValue] = useState<{ subject: string; teacher: string; room: string; notes: string }>({ subject: "", teacher: "", room: "", notes: "" });
  const [aiFeedback, setAiFeedback] = useState("");

  // Derive chips automatically from existing slots
  useEffect(() => {
    const seen = new Set<string>();
    const derived: SubjectChip[] = [];
    for (const s of slots) {
      if (!s.subject_name || s.is_break) continue;
      const k = s.subject_name + "|" + (s.teacher_name ?? "") + "|" + (s.room ?? "");
      if (seen.has(k)) continue;
      seen.add(k);
      derived.push({ name: s.subject_name, teacher: s.teacher_name ?? "", room: s.room ?? "" });
    }
    setChips((prev) => {
      const known = new Set(prev.map((c) => c.name + "|" + (c.teacher ?? "") + "|" + (c.room ?? "")));
      return [...prev, ...derived.filter((d) => !known.has(d.name + "|" + (d.teacher ?? "") + "|" + (d.room ?? "")))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlots]);

  const conflicts = useMemo(() => detectConflicts(slots), [slots]);
  const subjectCounts = useMemo(() => periodsBySubject(slots), [slots]);

  const slotAt = (day: number, period: number) =>
    slots.find((s) => s.day_of_week === day && s.period_index === period && !s.is_break);

  const setCell = (day: number, period: number, patch: Partial<SlotRow>) => {
    const found = slotAt(day, period);
    const start = schedule.find((p) => p.index === period && !p.isBreak);
    if (!start) return;
    const next = slots.map((s) =>
      s.day_of_week === day && s.period_index === period && !s.is_break
        ? { ...s, ...patch, is_manual_override: true } : s);
    if (!found) {
      next.push({
        definition_id: definitionId, day_of_week: day, period_index: period,
        start_time: start.start, end_time: start.end, is_break: false,
        is_manual_override: true, ...patch,
      });
    }
    pushHistory(next);
  };

  const clearCell = (day: number, period: number) => {
    pushHistory(slots.map((s) =>
      s.day_of_week === day && s.period_index === period && !s.is_break
        ? { ...s, subject_name: null, teacher_name: null, room: null, notes: null } : s));
  };

  const openEditor = (day: number, period: number) => {
    const s = slotAt(day, period);
    setEditValue({ subject: s?.subject_name ?? "", teacher: s?.teacher_name ?? "", room: s?.room ?? "", notes: s?.notes ?? "" });
    setEditing({ day, period });
  };

  const onCellClick = (day: number, period: number) => {
    if (selectedChip !== null) {
      const c = chips[selectedChip];
      setCell(day, period, { subject_name: c.name, teacher_name: c.teacher, room: c.room, subject_color: colorForSubject(c.name) });
      return;
    }
    openEditor(day, period);
  };

  const addChip = () => {
    if (!chipDraft.name.trim()) return;
    setChips((p) => [...p, chipDraft]);
    setChipDraft({ name: "", teacher: "", room: "" });
  };

  const print = () => {
    const html = printableTimetableHtml(defName, schoolDays, schedule, slots);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const conflictSlotIds = new Set<string>();
  for (const c of conflicts) for (const id of c.slot_ids ?? []) conflictSlotIds.add(id);

  return (
    <div className="grid grid-cols-[260px,1fr] gap-4">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide">Subject Chips</Label>
            <p className="text-xs text-muted-foreground mb-2">Click a chip then click a cell to assign.</p>
            <div className="space-y-2">
              <Input value={chipDraft.name} onChange={(e) => setChipDraft({ ...chipDraft, name: e.target.value })} placeholder="Subject name" />
              <Input value={chipDraft.teacher} onChange={(e) => setChipDraft({ ...chipDraft, teacher: e.target.value })} placeholder="Teacher" />
              <Input value={chipDraft.room} onChange={(e) => setChipDraft({ ...chipDraft, room: e.target.value })} placeholder="Room" />
              <Button size="sm" className="w-full" onClick={addChip}>Add chip</Button>
            </div>
            <div className="mt-3 space-y-1 max-h-72 overflow-auto">
              {chips.map((c, i) => {
                const used = subjectCounts[c.name] ?? 0;
                const isSel = selectedChip === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedChip(isSel ? null : i)}
                    className={`w-full text-left px-2 py-1.5 rounded-md border text-xs flex items-center justify-between ${isSel ? "ring-2 ring-primary" : ""}`}
                    style={{ borderLeft: `4px solid ${colorForSubject(c.name)}` }}
                  >
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-muted-foreground">{c.teacher} · {c.room}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{used}</Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Conflicts</span>
              <Badge variant={conflicts.length ? "destructive" : "secondary"}>{conflicts.length}</Badge>
            </div>
            <div className="space-y-1 max-h-48 overflow-auto">
              {conflicts.length === 0 && <p className="text-xs text-muted-foreground">No conflicts detected.</p>}
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs p-2 rounded bg-destructive/10 border border-destructive/30 flex gap-2">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                  <span>{c.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={!history.current.length}><Undo2 className="h-3 w-3 mr-1" />Undo</Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={!future.current.length}><Redo2 className="h-3 w-3 mr-1" />Redo</Button>
            <Button size="sm" variant="outline" onClick={print}><Printer className="h-3 w-3 mr-1" />Print</Button>
            {onAIRegenerate && (
              <div className="flex items-center gap-1">
                <Input value={aiFeedback} onChange={(e) => setAiFeedback(e.target.value)} placeholder="Tell AI what to change…" className="h-8 w-64" />
                <Button size="sm" variant="outline" onClick={() => onAIRegenerate(aiFeedback)} className="border-purple-300">
                  <Sparkles className="h-3 w-3 mr-1 text-purple-500" />Regenerate
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onSave(slots)} disabled={saving}><Save className="h-3 w-3 mr-1" />Save Draft</Button>
            {onPublish && <Button size="sm" onClick={async () => { await onSave(slots); await onPublish(); }} disabled={conflicts.length > 0 || saving}><CheckCircle2 className="h-3 w-3 mr-1" />Validate & Publish</Button>}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background z-10">
                <tr>
                  <th className="p-2 border-b text-left w-28">Time</th>
                  {schoolDays.map((d) => <th key={d} className="p-2 border-b text-left">{dayName(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {schedule.map((p, ridx) => {
                  if (p.isBreak) {
                    return (
                      <tr key={`b-${ridx}`} className="bg-muted/40">
                        <td className="p-2 text-xs font-semibold">{p.start}–{p.end}<br /><span className="text-muted-foreground">{p.label}</span></td>
                        {schoolDays.map((d) => <td key={d} className="p-2 text-center text-xs text-muted-foreground italic">{p.label}</td>)}
                      </tr>
                    );
                  }
                  return (
                    <tr key={`p-${p.index}`}>
                      <td className="p-2 text-xs font-semibold border-b">{p.start}–{p.end}<br /><span className="text-muted-foreground">P{p.index + 1}</span></td>
                      {schoolDays.map((d) => {
                        const s = slotAt(d, p.index);
                        const hasConflict = s && conflictSlotIds.has(s.id ?? "");
                        return (
                          <td key={d} className="p-1 border-b align-top">
                            <button
                              onClick={() => onCellClick(d, p.index)}
                              onContextMenu={(e) => { e.preventDefault(); clearCell(d, p.index); }}
                              className={`w-full min-h-[64px] text-left p-2 rounded border transition ${hasConflict ? "border-destructive bg-destructive/10" : s?.subject_name ? "border-border" : "border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40"}`}
                              style={s?.subject_name ? { borderLeft: `4px solid ${s.subject_color ?? colorForSubject(s.subject_name)}` } : undefined}
                              title="Click: assign chip or edit · Right-click: clear"
                            >
                              {s?.subject_name ? (
                                <div className="text-xs">
                                  <div className="font-semibold flex items-center gap-1">
                                    {s.subject_name}
                                    {s.is_manual_override && <Pencil className="h-2.5 w-2.5 text-muted-foreground" />}
                                    {hasConflict && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                  </div>
                                  <div className="text-muted-foreground">{s.teacher_name}</div>
                                  <div className="text-muted-foreground">{s.room}</div>
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-foreground">Click to assign</div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cell</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Subject</Label><Input value={editValue.subject} onChange={(e) => setEditValue({ ...editValue, subject: e.target.value })} /></div>
            <div><Label>Teacher</Label><Input value={editValue.teacher} onChange={(e) => setEditValue({ ...editValue, teacher: e.target.value })} /></div>
            <div><Label>Room</Label><Input value={editValue.room} onChange={(e) => setEditValue({ ...editValue, room: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={editValue.notes} onChange={(e) => setEditValue({ ...editValue, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { if (editing) clearCell(editing.day, editing.period); setEditing(null); }}>
              <Trash2 className="h-3 w-3 mr-1" />Clear
            </Button>
            <Button onClick={() => {
              if (!editing) return;
              setCell(editing.day, editing.period, {
                subject_name: editValue.subject || null,
                teacher_name: editValue.teacher || null,
                room: editValue.room || null,
                notes: editValue.notes || null,
                subject_color: editValue.subject ? colorForSubject(editValue.subject) : null,
              });
              setEditing(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
