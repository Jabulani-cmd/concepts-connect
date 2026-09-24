import { useAllocation } from "@/contexts/AllocationContext";
import TimetableGrid from "@/components/allocation/TimetableGrid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  /** Which view: a teacher's personal schedule, or a class schedule (for student/parent). */
  mode: "teacher" | "class";
  teacherId?: string;
  classId?: string;
  title?: string;
  subtitle?: string;
}

/** Reusable portal widget that any of Teacher / Student / Parent dashboards can drop in. */
export default function PortalTimetableView({ mode, teacherId, classId, title, subtitle }: Props) {
  const { slots, subjects, teachers, rooms, classes } = useAllocation();

  const today = (() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? d - 1 : -1;
  })();

  const mine = slots.filter((s) => {
    if (!s.subjectId) return false;
    if (mode === "teacher" && teacherId) return s.teacherId === teacherId;
    if (mode === "class" && classId) return s.classId === classId;
    return false;
  });

  const todayPeriods = mine
    .filter((s) => s.day === today)
    .sort((a, b) => a.period - b.period);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title ?? "My Timetable"}</h1>
        <p className="text-muted-foreground text-sm">{subtitle ?? "Live view: synced across all portals."}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Today {today === -1 ? "(weekend)" : ""}
          </CardTitle>
          <CardDescription>
            You have <span className="font-semibold text-foreground">{todayPeriods.length}</span> period
            {todayPeriods.length === 1 ? "" : "s"} scheduled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayPeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No periods today.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayPeriods.map((s) => {
                const subj = subjects.find((x) => x.id === s.subjectId)!;
                const teacher = teachers.find((x) => x.id === s.teacherId);
                const room = rooms.find((x) => x.id === s.roomId);
                const cls = classes.find((x) => x.id === s.classId);
                return (
                  <Card
                    key={s.id}
                    className="p-3 border-l-4 transition hover:shadow-md"
                    style={{ borderLeftColor: subj.color }}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Period {s.period}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">{s.startTime}–{s.endTime}</span>
                    </div>
                    <div className="mt-2 font-semibold">{subj.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Class: {cls?.name ?? "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Teacher: {teacher?.name ?? "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Venue: {room?.name ?? "-"}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Weekly schedule</CardTitle>
          <CardDescription>Every cell shows Period, Subject, Teacher and Venue.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimetableGrid teacherId={mode === "teacher" ? teacherId : undefined} classId={mode === "class" ? classId : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
