import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type TimeSlot = { start: string; end: string; isBreak?: boolean; isSports?: boolean; label?: string };

const defaultTimeSlots: TimeSlot[] = [
  { start: "07:30", end: "08:10" },
  { start: "08:10", end: "08:50" },
  { start: "08:50", end: "09:30" },
  { start: "09:30", end: "09:50", isBreak: true, label: "Break" },
  { start: "09:50", end: "10:30" },
  { start: "10:30", end: "11:10" },
  { start: "11:10", end: "11:50" },
  { start: "11:50", end: "12:30" },
  { start: "12:30", end: "13:10" },
  { start: "13:10", end: "13:50", isBreak: true, label: "Lunch" },
  { start: "13:50", end: "14:30" },
  { start: "14:30", end: "15:10" },
  { start: "15:10", end: "15:30", isBreak: true, label: "Break" },
  { start: "15:30", end: "16:10", isSports: true },
  { start: "16:10", end: "17:00", isSports: true },
];

function normalizeTime(t?: string) {
  if (!t) return "";
  return t.slice(0, 5); // "07:30:00" -> "07:30"
}


interface TimetableEntry {
  day_of_week: number;
  start_time: string;
  end_time?: string;
  subjects?: { name: string } | null;
  staff?: { full_name: string } | null;
  classes?: { name: string } | null;
  room?: string | null;
  activity_name?: string;
  venue?: string;
}

interface Props {
  entries: TimetableEntry[];
  sportsSchedule?: TimetableEntry[];
  sportsActivities?: string[];
  title?: string;
  loading?: boolean;
  noClassMessage?: string;
  hasClass?: boolean;
}

export default function FullWeekTimetable({
  entries,
  sportsSchedule = [],
  sportsActivities = [],
  title = "Class Timetable",
  loading = false,
  noClassMessage = "No class assignment found.",
  hasClass = true,
}: Props) {
  const today = new Date().getDay(); // 0=Sun, 1=Mon...

  // Detect whether entries use 0-indexed (0=Mon) or 1-indexed (1=Mon) days
  const dayOffset = useMemo(() => {
    if (!entries.length) return 1; // default 1-indexed
    const min = Math.min(...entries.map((e) => e.day_of_week ?? 99));
    return min === 0 ? 0 : 1;
  }, [entries]);

  // Build time slots dynamically from actual entries, fallback to defaults
  const timeSlots = useMemo((): TimeSlot[] => {
    const allTimes = [
      ...entries.map((e) => ({ start: normalizeTime(e.start_time), end: normalizeTime(e.end_time) })),
      ...sportsSchedule.map((e) => ({ start: normalizeTime(e.start_time), end: normalizeTime(e.end_time), isSports: true })),
    ].filter((s) => s.start);

    if (allTimes.length === 0) return defaultTimeSlots;

    const uniq = new Map<string, TimeSlot>();
    for (const s of allTimes) {
      if (!uniq.has(s.start)) uniq.set(s.start, s);
    }
    return Array.from(uniq.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [entries, sportsSchedule]);

  const getCell = useMemo(() => {
    return (startTime: string, dayIndex: number) => {
      const target = normalizeTime(startTime);
      return entries.find(
        (t) => normalizeTime(t.start_time) === target && t.day_of_week === dayIndex + dayOffset
      );
    };
  }, [entries, dayOffset]);

  const getSportsCell = useMemo(() => {
    return (startTime: string, dayIndex: number) => {
      const target = normalizeTime(startTime);
      return sportsSchedule.find(
        (t) => normalizeTime(t.start_time) === target && t.day_of_week === dayIndex + dayOffset
      );
    };
  }, [sportsSchedule, dayOffset]);


  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!hasClass) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{noClassMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] text-xs font-semibold">Time</TableHead>
                {days.map((d, i) => (
                  <TableHead
                    key={d}
                    className={`text-center text-xs font-semibold ${
                      today === i + 1 ? "bg-secondary/10 text-secondary" : ""
                    }`}
                  >
                    {d}
                    {today === i + 1 && (
                      <span className="ml-1 text-[9px] font-normal">(Today)</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => { let periodCounter = 0; return timeSlots.map((slot, si) => {
                const periodNum = !slot.isBreak ? ++periodCounter : null;
                return (
                <TableRow
                  key={si}
                  className={
                    slot.isBreak
                      ? "bg-muted/40"
                      : slot.isSports
                        ? "bg-accent/5"
                        : ""
                  }
                >
                  <TableCell className="whitespace-nowrap py-2 text-xs font-medium">
                    {periodNum && (
                      <span className="block text-[10px] font-bold text-primary">
                        P{periodNum}
                      </span>
                    )}
                    {slot.start}–{slot.end}
                    {slot.isBreak && (
                      <span className="block text-[10px] text-muted-foreground italic">
                        {slot.label}
                      </span>
                    )}
                    {slot.isSports && (
                      <span className="block text-[10px] text-muted-foreground italic">
                        Sports/Clubs
                      </span>
                    )}
                  </TableCell>
                  {slot.isBreak ? (
                    <TableCell
                      colSpan={5}
                      className="py-2 text-center text-xs italic text-muted-foreground"
                    >
                      {slot.label}
                    </TableCell>
                  ) : (
                    days.map((_, di) => {
                      const entry = slot.isSports
                        ? getSportsCell(slot.start, di)
                        : getCell(slot.start, di);

                      return (
                        <TableCell
                          key={di}
                          className={`py-2 text-center text-xs align-top ${
                            today === di + 1 ? "bg-secondary/5" : ""
                          }`}
                        >
                          {entry ? (
                            <div className="space-y-0.5">
                              <span className="block font-semibold">
                                {entry.subjects?.name || entry.activity_name || "-"}
                              </span>
                              {entry.classes?.name && (
                                <span className="block text-[10px] text-foreground/80">
                                  Class: {entry.classes.name}
                                </span>
                              )}
                              {entry.staff?.full_name && (
                                <span className="block text-[10px] text-muted-foreground">
                                  {entry.staff.full_name}
                                </span>
                              )}
                              {(entry.room || entry.venue) && (
                                <Badge
                                  variant="outline"
                                  className="mt-0.5 px-1 py-0 text-[8px]"
                                >
                                  {entry.room || entry.venue}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </TableCell>
                      );
                    })
                  )}
                </TableRow>
                );
              }); })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {sportsActivities.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-secondary" />
              <h3 className="text-sm font-semibold">Sports & Activities</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sportsActivities.map((sport) => (
                <Badge key={sport} variant="secondary" className="text-xs">
                  {sport}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
