import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const DAY_OPTS = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" },
  { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" },
];

export interface SetupValue {
  name: string;
  type: "class" | "exam";
  classLabel: string;
  term: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  schoolDays: number[];
  periodMinutes: number;
  periodsPerDay: number;
  dayStartTime: string;
  breaks: Array<{ afterPeriod: number; label: string; minutes: number }>;
  aiMode: boolean;
  // AI-only:
  subjects: Array<{
    name: string; periodsPerWeek: number; teacher?: string; room?: string;
    preferredTime?: "morning" | "afternoon" | "any"; allowDouble?: boolean;
  }>;
  constraints: {
    maxConsecutive?: number; coreInMorning?: boolean; avoidSameDay?: boolean;
    distributeEvenly?: boolean; lunchInMiddle?: boolean;
  };
  freeText?: string;
}

const DEFAULT_VALUE: SetupValue = {
  name: "", type: "class", classLabel: "", term: "Term 1", academicYear: "2025",
  startDate: "", endDate: "", schoolDays: [1, 2, 3, 4, 5],
  periodMinutes: 40, periodsPerDay: 8, dayStartTime: "07:30",
  breaks: [
    { afterPeriod: 2, label: "Morning Break", minutes: 20 },
    { afterPeriod: 5, label: "Lunch", minutes: 40 },
  ],
  aiMode: false,
  subjects: [],
  constraints: { maxConsecutive: 3, coreInMorning: true, lunchInMiddle: true, distributeEvenly: true },
  freeText: "",
};

interface Props {
  open: boolean;
  aiMode: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (v: SetupValue) => void;
}

export default function TimetableSetupDialog({ open, aiMode, onOpenChange, onSubmit }: Props) {
  const [v, setV] = useState<SetupValue>({ ...DEFAULT_VALUE, aiMode });
  const upd = (patch: Partial<SetupValue>) => setV((prev) => ({ ...prev, ...patch }));

  const toggleDay = (d: number) =>
    upd({ schoolDays: v.schoolDays.includes(d) ? v.schoolDays.filter((x) => x !== d) : [...v.schoolDays, d].sort() });

  const addBreak = () => upd({ breaks: [...v.breaks, { afterPeriod: 1, label: "Break", minutes: 15 }] });
  const updBreak = (i: number, patch: Partial<typeof v.breaks[0]>) =>
    upd({ breaks: v.breaks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  const rmBreak = (i: number) => upd({ breaks: v.breaks.filter((_, idx) => idx !== i) });

  const addSubject = () =>
    upd({ subjects: [...v.subjects, { name: "", periodsPerWeek: 4, preferredTime: "any" }] });
  const updSubject = (i: number, patch: Partial<typeof v.subjects[0]>) =>
    upd({ subjects: v.subjects.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const rmSubject = (i: number) => upd({ subjects: v.subjects.filter((_, idx) => idx !== i) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {aiMode && <Sparkles className="h-5 w-5 text-purple-500" />}
            {aiMode ? "AI Timetable Setup" : "Manual Timetable Setup"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Timetable Name</Label>
              <Input value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Form 1A - Term 2 2026" /></div>
            <div><Label>Type</Label>
              <Select value={v.type} onValueChange={(t) => upd({ type: t as "class" | "exam" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="class">Class Timetable</SelectItem><SelectItem value="exam">Exam Timetable</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Form / Class</Label>
              <Input value={v.classLabel} onChange={(e) => upd({ classLabel: e.target.value })} placeholder="Form 1A" /></div>
            <div><Label>Academic Year</Label>
              <Input value={v.academicYear} onChange={(e) => upd({ academicYear: e.target.value })} /></div>
            <div><Label>Term</Label>
              <Select value={v.term} onValueChange={(t) => upd({ term: t })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Day Start Time</Label>
              <Input type="time" value={v.dayStartTime} onChange={(e) => upd({ dayStartTime: e.target.value })} /></div>
            <div><Label>Start Date</Label>
              <Input type="date" value={v.startDate} onChange={(e) => upd({ startDate: e.target.value })} /></div>
            <div><Label>End Date</Label>
              <Input type="date" value={v.endDate} onChange={(e) => upd({ endDate: e.target.value })} /></div>
            <div><Label>Period Duration (min)</Label>
              <Select value={String(v.periodMinutes)} onValueChange={(x) => upd({ periodMinutes: Number(x) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[30,40,45,60].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Periods per Day</Label>
              <Input type="number" min={1} max={12} value={v.periodsPerDay} onChange={(e) => upd({ periodsPerDay: Number(e.target.value) })} /></div>
          </div>

          <div>
            <Label>School Days</Label>
            <div className="flex gap-3 mt-2">
              {DAY_OPTS.map((d) => (
                <label key={d.v} className="flex items-center gap-1 text-sm">
                  <Checkbox checked={v.schoolDays.includes(d.v)} onCheckedChange={() => toggleDay(d.v)} />{d.l}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between"><Label>Breaks</Label>
              <Button variant="outline" size="sm" onClick={addBreak}><Plus className="h-3 w-3 mr-1" />Add break</Button></div>
            <div className="space-y-2 mt-2">
              {v.breaks.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr,auto,auto,auto] gap-2 items-end">
                  <Input value={b.label} onChange={(e) => updBreak(i, { label: e.target.value })} placeholder="Label" />
                  <div><Label className="text-xs">After period</Label>
                    <Input type="number" min={0} className="w-24" value={b.afterPeriod} onChange={(e) => updBreak(i, { afterPeriod: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Minutes</Label>
                    <Input type="number" min={5} className="w-24" value={b.minutes} onChange={(e) => updBreak(i, { minutes: Number(e.target.value) })} /></div>
                  <Button variant="ghost" size="icon" onClick={() => rmBreak(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          {aiMode && v.type === "class" && (
            <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-purple-500" />Subject Requirements</Label>
                  <Button size="sm" variant="outline" onClick={addSubject}><Plus className="h-3 w-3 mr-1" />Add subject</Button>
                </div>
                {v.subjects.length === 0 && <p className="text-xs text-muted-foreground">Add the subjects this class needs and how many periods per week each requires.</p>}
                {v.subjects.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1.5fr,80px,1fr,1fr,120px,auto] gap-2 items-end">
                    <div><Label className="text-xs">Subject</Label><Input value={s.name} onChange={(e) => updSubject(i, { name: e.target.value })} /></div>
                    <div><Label className="text-xs">Periods/wk</Label><Input type="number" min={1} value={s.periodsPerWeek} onChange={(e) => updSubject(i, { periodsPerWeek: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Teacher</Label><Input value={s.teacher ?? ""} onChange={(e) => updSubject(i, { teacher: e.target.value })} /></div>
                    <div><Label className="text-xs">Room</Label><Input value={s.room ?? ""} onChange={(e) => updSubject(i, { room: e.target.value })} /></div>
                    <div><Label className="text-xs">Time</Label>
                      <Select value={s.preferredTime ?? "any"} onValueChange={(x) => updSubject(i, { preferredTime: x as SetupValue["subjects"][number]["preferredTime"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => rmSubject(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}

                <div className="border-t pt-3 mt-3">
                  <Label className="text-sm font-semibold mb-2 block">Constraints</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2"><Checkbox checked={!!v.constraints.coreInMorning} onCheckedChange={(c) => upd({ constraints: { ...v.constraints, coreInMorning: !!c } })} />Core subjects in the morning</label>
                    <label className="flex items-center gap-2"><Checkbox checked={!!v.constraints.avoidSameDay} onCheckedChange={(c) => upd({ constraints: { ...v.constraints, avoidSameDay: !!c } })} />Avoid same subject on consecutive days</label>
                    <label className="flex items-center gap-2"><Checkbox checked={!!v.constraints.distributeEvenly} onCheckedChange={(c) => upd({ constraints: { ...v.constraints, distributeEvenly: !!c } })} />Distribute periods evenly</label>
                    <label className="flex items-center gap-2"><Checkbox checked={!!v.constraints.lunchInMiddle} onCheckedChange={(c) => upd({ constraints: { ...v.constraints, lunchInMiddle: !!c } })} />Lunch in the middle of the day</label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Free-text instructions for the AI (optional)</Label>
                  <Textarea rows={2} value={v.freeText ?? ""} onChange={(e) => upd({ freeText: e.target.value })} placeholder="e.g., Sports on Wednesday afternoons" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSubmit(v); onOpenChange(false); }} className={aiMode ? "bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700" : ""}>
            {aiMode ? <><Sparkles className="h-4 w-4 mr-1" />Generate Timetable with AI</> : "Proceed to Build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
