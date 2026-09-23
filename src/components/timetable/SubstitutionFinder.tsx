import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, UserSearch, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SlotRow, dayName } from "@/lib/timetableUtils";
import { errorMessage } from "@/lib/errors";

export default function SubstitutionFinder({ allSlots }: { allSlots: SlotRow[] }) {
  const { toast } = useToast();
  const [absent, setAbsent] = useState("");
  const [day, setDay] = useState(1);
  const [period, setPeriod] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ranked, setRanked] = useState<Array<{ name: string; score: number; reason: string }>>([]);

  const affectedSlots = allSlots.filter((s) => s.teacher_name === absent);

  const find = async () => {
    setLoading(true); setRanked([]);
    try {
      // Build candidates from all known teachers in the data
      const teacherSubjects: Record<string, Set<string>> = {};
      const teacherLoad: Record<string, number> = {};
      const teacherBusy: Record<string, Array<{ day: number; period: number }>> = {};
      for (const s of allSlots) {
        if (!s.teacher_name || s.is_break) continue;
        teacherSubjects[s.teacher_name] ??= new Set();
        teacherSubjects[s.teacher_name].add(s.subject_name ?? "");
        teacherLoad[s.teacher_name] = (teacherLoad[s.teacher_name] ?? 0) + 1;
        teacherBusy[s.teacher_name] ??= [];
        teacherBusy[s.teacher_name].push({ day: s.day_of_week, period: s.period_index });
      }
      const subjectNeeded = allSlots.find((s) => s.teacher_name === absent && s.day_of_week === day && s.period_index === period)?.subject_name;
      const candidates = Object.keys(teacherSubjects)
        .filter((n) => n !== absent)
        .filter((n) => !(teacherBusy[n] ?? []).some((x) => x.day === day && x.period === period))
        .map((n) => ({
          name: n,
          subjects: Array.from(teacherSubjects[n]),
          periodsThisWeek: teacherLoad[n] ?? 0,
        }));

      const { data, error } = await supabase.functions.invoke("ai-find-substitute", {
        body: { absentTeacher: absent, subject: subjectNeeded, day, period, candidates },
      });
      if (error) throw error;
      setRanked(data?.ranked ?? []);
    } catch (e) {
      toast({ variant: "destructive", title: "Substitute search failed", description: errorMessage(e) });
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2"><UserSearch className="h-4 w-4" /><h4 className="font-semibold">AI Substitute Finder</h4></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Absent teacher</Label><Input value={absent} onChange={(e) => setAbsent(e.target.value)} placeholder="Mr Ncube" /></div>
          <div><Label className="text-xs">Day</Label>
            <select className="w-full h-10 border rounded px-2 text-sm bg-background" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {[1,2,3,4,5,6].map((d) => <option key={d} value={d}>{dayName(d)}</option>)}
            </select></div>
          <div><Label className="text-xs">Period (0-based)</Label><Input type="number" min={0} value={period} onChange={(e) => setPeriod(Number(e.target.value))} /></div>
        </div>
        {absent && affectedSlots.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="text-orange-600 font-semibold">{affectedSlots.length} periods affected this week.</span> Highlighted in views as orange.
          </div>
        )}
        <Button size="sm" onClick={find} disabled={!absent || loading} className="bg-gradient-to-r from-purple-600 to-fuchsia-600">
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}Find substitute
        </Button>
        {ranked.length > 0 && (
          <div className="space-y-1">
            {ranked.map((r, i) => (
              <div key={i} className="p-2 border rounded text-xs flex items-center justify-between">
                <div><div className="font-semibold">{r.name}</div><div className="text-muted-foreground">{r.reason}</div></div>
                <Badge variant="secondary">{r.score}/100</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
