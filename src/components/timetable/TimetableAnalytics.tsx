import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SlotRow } from "@/lib/timetableUtils";

interface Props { allSlots: SlotRow[]; }

export default function TimetableAnalytics({ allSlots }: Props) {
  const teaching = useMemo(() => allSlots.filter((s) => !s.is_break && s.subject_name), [allSlots]);

  const byTeacher = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of teaching) if (s.teacher_name) m[s.teacher_name] = (m[s.teacher_name] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [teaching]);

  const byRoom = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of teaching) if (s.room) m[s.room] = (m[s.room] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [teaching]);

  const bySubject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of teaching) if (s.subject_name) m[s.subject_name] = (m[s.subject_name] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [teaching]);

  const maxTeacher = byTeacher[0]?.[1] || 1;
  const maxSubject = bySubject[0]?.[1] || 1;
  const maxRoom = byRoom[0]?.[1] || 1;

  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-3">Teacher workload</h4>
          <div className="space-y-1.5">
            {byTeacher.slice(0, 12).map(([n, c]) => (
              <div key={n}>
                <div className="flex justify-between text-xs"><span>{n}</span><span className="text-muted-foreground">{c}</span></div>
                <div className="h-1.5 bg-muted rounded"><div className="h-1.5 rounded bg-primary" style={{ width: `${(c / maxTeacher) * 100}%` }} /></div>
              </div>
            ))}
            {!byTeacher.length && <p className="text-xs text-muted-foreground">No data.</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-3">Subject distribution</h4>
          <div className="space-y-1.5">
            {bySubject.slice(0, 12).map(([n, c]) => (
              <div key={n}>
                <div className="flex justify-between text-xs"><span>{n}</span><span className="text-muted-foreground">{c}</span></div>
                <div className="h-1.5 bg-muted rounded"><div className="h-1.5 rounded bg-purple-500" style={{ width: `${(c / maxSubject) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-3">Room utilisation</h4>
          <div className="space-y-1.5">
            {byRoom.slice(0, 12).map(([n, c]) => (
              <div key={n}>
                <div className="flex justify-between text-xs"><span>{n}</span><span className="text-muted-foreground">{c}</span></div>
                <div className="h-1.5 bg-muted rounded"><div className="h-1.5 rounded bg-orange-500" style={{ width: `${(c / maxRoom) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
