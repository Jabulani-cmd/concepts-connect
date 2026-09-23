import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";

interface ExamSlot {
  id?: string;
  exam_date: string;
  session: string; // "morning" | "afternoon"
  start_time?: string;
  end_time?: string;
  subject_name: string;
  class_label: string;
  venue?: string;
  capacity?: number;
  invigilator_name?: string;
}

type AiExamSlot = {
  date: string; session: string; start_time?: string; end_time?: string;
  subject: string; grade: string; venue?: string; invigilator?: string;
};

interface Props {
  definitionId: string;
  startDate: string;
  endDate: string;
  initialSlots: ExamSlot[];
  onSaved: () => void;
  aiMode: boolean;
}

export default function ExamTimetableBuilder({ definitionId, startDate, endDate, initialSlots, onSaved, aiMode }: Props) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<ExamSlot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSlots(initialSlots), [initialSlots]);

  const dates: string[] = (() => {
    if (!startDate || !endDate) return [];
    const out: string[] = [];
    const s = new Date(startDate), e = new Date(endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
    return out;
  })();

  const add = () => setSlots((p) => [...p, {
    exam_date: dates[0] ?? "", session: "morning", subject_name: "", class_label: "", venue: "", capacity: 30,
  }]);
  const upd = (i: number, patch: Partial<ExamSlot>) => setSlots((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const rm = (i: number) => setSlots((p) => p.filter((_, idx) => idx !== i));

  const generateAI = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-exam-timetable", {
        body: { dates, existingSlots: slots, subjects: slots.map(s => s.subject_name).filter(Boolean) },
      });
      if (error) throw error;
      const aiSlots: AiExamSlot[] = data?.slots ?? [];
      const generated: ExamSlot[] = aiSlots.map((s) => ({
        exam_date: s.date, session: s.session, start_time: s.start_time, end_time: s.end_time,
        subject_name: s.subject, class_label: s.grade, venue: s.venue, invigilator_name: s.invigilator,
      }));
      setSlots(generated);
      toast({ title: "AI exam timetable generated", description: data?.summary });
    } catch (e) {
      toast({ variant: "destructive", title: "Generation failed", description: errorMessage(e) });
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await supabase.from("tt_exam_slots").delete().eq("definition_id", definitionId);
      const rows = slots.filter((s) => s.exam_date && s.subject_name).map((s) => ({ ...s, definition_id: definitionId }));
      if (rows.length) {
        const { error } = await supabase.from("tt_exam_slots").insert(rows);
        if (error) throw error;
      }
      toast({ title: "Exam timetable saved" });
      onSaved();
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: errorMessage(e) });
    } finally { setBusy(false); }
  };

  // Clash detection: same class in same date/session
  const clashes: string[] = (() => {
    const seen = new Map<string, number>();
    const out: string[] = [];
    for (const s of slots) {
      const k = `${s.exam_date}|${s.session}|${s.class_label}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const [k, c] of seen) if (c > 1) out.push(`Clash: ${k.replace(/\|/g, " · ")} (${c} exams)`);
    return out;
  })();

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={add}><Plus className="h-3 w-3 mr-1" />Add exam</Button>
          {aiMode && (
            <Button size="sm" variant="outline" onClick={generateAI} disabled={busy} className="border-purple-300">
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1 text-purple-500" />}
              Generate with AI
            </Button>
          )}
        </div>
        <Button size="sm" onClick={save} disabled={busy}>Save Exam Timetable</Button>
      </div>

      {clashes.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-3 text-xs space-y-1">
            <div className="font-semibold text-destructive">Clash warnings</div>
            {clashes.map((c, i) => <div key={i}>{c}</div>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Date</th><th className="p-2 text-left">Session</th>
                <th className="p-2 text-left">Subject</th><th className="p-2 text-left">Form / Class</th>
                <th className="p-2 text-left">Venue</th><th className="p-2 text-left">Capacity</th>
                <th className="p-2 text-left">Invigilator</th><th></th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No exams yet.</td></tr>}
              {slots.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1"><Input type="date" min={startDate} max={endDate} value={s.exam_date} onChange={(e) => upd(i, { exam_date: e.target.value })} /></td>
                  <td className="p-1">
                    <select className="w-full h-9 border rounded px-2 bg-background" value={s.session} onChange={(e) => upd(i, { session: e.target.value })}>
                      <option value="morning">Morning</option><option value="afternoon">Afternoon</option>
                    </select>
                  </td>
                  <td className="p-1"><Input value={s.subject_name} onChange={(e) => upd(i, { subject_name: e.target.value })} /></td>
                  <td className="p-1"><Input value={s.class_label} onChange={(e) => upd(i, { class_label: e.target.value })} /></td>
                  <td className="p-1"><Input value={s.venue ?? ""} onChange={(e) => upd(i, { venue: e.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={s.capacity ?? 0} onChange={(e) => upd(i, { capacity: Number(e.target.value) })} /></td>
                  <td className="p-1"><Input value={s.invigilator_name ?? ""} onChange={(e) => upd(i, { invigilator_name: e.target.value })} /></td>
                  <td className="p-1"><Button variant="ghost" size="icon" onClick={() => rm(i)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
