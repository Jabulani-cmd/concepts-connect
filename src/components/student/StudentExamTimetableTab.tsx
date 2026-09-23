import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, MapPin, Loader2, AlertCircle } from "lucide-react";
import { format, isAfter, isToday } from "date-fns";

interface ExamTimetableEntry {
  id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  notes: string | null;
  subjects: { name: string; code: string | null } | null;
  exams: { 
    name: string; 
    form_level: string; 
    term: string; 
    academic_year: string;
  } | null;
}

interface Props {
  studentId?: string | null;
  formLevel?: string | null;
  showAll?: boolean;
}

export default function StudentExamTimetableTab({ studentId, formLevel, showAll }: Props = {}) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExamTimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentForm, setStudentForm] = useState<string | null>(formLevel || null);

  const fetchStudentInfo = useCallback(async () => {
    if (!user?.id && !studentId) { setLoading(false); return; }
    
    let query = supabase.from("students").select("form");
    if (studentId) {
      query = query.eq("id", studentId);
    } else {
      query = query.eq("user_id", user!.id);
    }
    const { data: student } = await query.single();

    if (student?.form) {
      setStudentForm(student.form);
      fetchTimetable(student.form);
    } else {
      setLoading(false);
    }
  }, [studentId, user]);

  useEffect(() => {
    if (showAll) {
      fetchAllTimetables();
    } else if (formLevel) {
      setStudentForm(formLevel);
      fetchTimetable(formLevel);
    } else {
      fetchStudentInfo();
    }
  }, [user, studentId, formLevel, showAll, fetchStudentInfo]);

  async function fetchAllTimetables() {
    const { data } = await supabase
      .from("exam_timetable_entries")
      .select(`
        id, exam_date, start_time, end_time, venue, notes,
        subjects(name, code),
        exams!inner(name, form_level, term, academic_year, is_published)
      `)
      .eq("exams.is_published", true)
      .gte("exam_date", new Date().toISOString().split("T")[0])
      .order("exam_date")
      .order("start_time");

    if (data) setEntries(data as ExamTimetableEntry[]);
    setStudentForm("all");
    setLoading(false);
  }

  async function fetchTimetable(formLevel: string) {
    const { data } = await supabase
      .from("exam_timetable_entries")
      .select(`
        id, exam_date, start_time, end_time, venue, notes,
        subjects(name, code),
        exams!inner(name, form_level, term, academic_year, is_published)
      `)
      .eq("exams.form_level", formLevel)
      .eq("exams.is_published", true)
      .gte("exam_date", new Date().toISOString().split("T")[0])
      .order("exam_date")
      .order("start_time");

    if (data) setEntries(data as ExamTimetableEntry[]);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  }

  if (!studentForm) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load exam timetable. Student form not found.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by exam
  const groupedByExam = entries.reduce((acc, entry) => {
    const examKey = entry.exams?.name || "Unknown";
    if (!acc[examKey]) acc[examKey] = { exam: entry.exams, entries: [] };
    acc[examKey].entries.push(entry);
    return acc;
  }, {} as Record<string, { exam: ExamTimetableEntry["exams"]; entries: ExamTimetableEntry[] }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Exam Timetable
        </CardTitle>
        <CardDescription>{showAll ? "All upcoming examination schedules" : "Your upcoming examination schedule"}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No upcoming exams scheduled</p>
            <p className="text-sm mt-1">Check back later for your exam timetable</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByExam).map(([examName, { exam, entries }]) => (
              <div key={examName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{examName}</h3>
                  {exam && (
                    <Badge variant="outline" className="text-xs">
                      {exam.form_level} · {exam.term} {exam.academic_year}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-3">
                  {entries.map(entry => {
                    const examDate = new Date(entry.exam_date);
                    const isUpcoming = isAfter(examDate, new Date());
                    const isExamToday = isToday(examDate);

                    return (
                      <div 
                        key={entry.id} 
                        className={`p-4 rounded-lg border ${
                          isExamToday 
                            ? "bg-accent/10 border-accent" 
                            : isUpcoming 
                              ? "bg-muted/50" 
                              : "bg-muted/20 opacity-60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="font-medium text-base">
                              {entry.subjects?.name}
                              {entry.subjects?.code && (
                                <span className="text-muted-foreground text-sm ml-1">
                                  ({entry.subjects.code})
                                </span>
                              )}
                            </h4>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(examDate, "EEEE, dd MMMM yyyy")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {entry.start_time} - {entry.end_time}
                              </span>
                              {entry.venue && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {entry.venue}
                                </span>
                              )}
                            </div>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {entry.notes}
                              </p>
                            )}
                          </div>
                          {isExamToday && (
                            <Badge className="bg-accent text-accent-foreground">Today</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
