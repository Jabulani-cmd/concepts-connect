import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  cover_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  classes: { name: string } | null;
  subjects: { name: string } | null;
}

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Cover (substitute) lessons this teacher has been given, from today on. Hidden when there are none. */
export default function MyCoverLessons({ staffId }: { staffId: string | null | undefined }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!staffId) return;
    const load = () =>
      supabase
        .from("timetable_cover")
        .select("id, cover_date, start_time, end_time, room, classes(name), subjects(name)")
        .eq("cover_staff_id", staffId)
        .eq("status", "assigned")
        .gte("cover_date", localDate())
        .order("cover_date")
        .order("start_time")
        .limit(20)
        .then(({ data, error }) => { if (!error) setRows((data as Row[] | null) ?? []); });
    load();
    const ch = supabase
      .channel(`my-cover-${staffId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_cover", filter: `cover_staff_id=eq.${staffId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [staffId]);

  if (!rows.length) return null;
  const today = localDate();
  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading flex items-center gap-2 text-base"><CalendarClock className="h-5 w-5 text-amber-600" /> My cover lessons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-background/80 px-3 py-2 text-sm">
            <span className="font-semibold">{r.cover_date === today ? "Today" : new Date(`${r.cover_date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span>{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</span>
            <span>{r.classes?.name ?? "Class"} · {r.subjects?.name ?? "Lesson"}</span>
            {r.room && <span className="text-muted-foreground">{r.room}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
