import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FullWeekTimetable from "@/components/shared/FullWeekTimetable";

interface Props {
  studentClassId: string | null;
  studentId?: string | null;
}

export default function StudentTimetableTab({ studentClassId, studentId }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [sportsSchedule, setSportsSchedule] = useState<any[]>([]);
  const [sportsActivities, setSportsActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedClassId, setResolvedClassId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    const resolveClassId = async () => {
      if (studentClassId) {
        if (mounted) setResolvedClassId(studentClassId);
        return;
      }

      if (!studentId) {
        if (mounted) setResolvedClassId(null);
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("form, stream")
        .eq("id", studentId)
        .maybeSingle();

      if (!student?.form) {
        if (mounted) setResolvedClassId(null);
        return;
      }

      let classId: string | null = null;

      if (student.stream) {
        const { data: exact } = await supabase
          .from("classes")
          .select("id")
          .eq("level", student.form)
          .eq("stream", student.stream)
          .limit(1)
          .maybeSingle();
        classId = exact?.id || null;
      }

      if (!classId) {
        const { data: fallback } = await supabase
          .from("classes")
          .select("id")
          .eq("level", student.form)
          .order("name")
          .limit(1)
          .maybeSingle();
        classId = fallback?.id || null;
      }

      if (mounted) setResolvedClassId(classId);
    };

    resolveClassId();
    return () => { mounted = false; };
  }, [studentClassId, studentId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (resolvedClassId === undefined) return;

      if (!resolvedClassId) {
        if (mounted) { setEntries([]); setSportsSchedule([]); setLoading(false); }
        return;
      }

      setLoading(true);
      const [{ data: detailed }, { data: sports }] = await Promise.all([
        supabase
          .from("timetable_entries")
          .select("*, subjects(name), staff(full_name), classes(name)")
          .eq("class_id", resolvedClassId)
          .order("start_time"),
        supabase
          .from("sports_schedule")
          .select("*")
          .eq("class_id", resolvedClassId)
          .order("start_time"),
      ]);

      if (!mounted) return;
      setEntries(detailed || []);
      setSportsSchedule(sports || []);
      setLoading(false);
    };

    load();

    // Realtime: refresh whenever any timetable_entries row for this class changes
    // (e.g. admin published a new manual edit).
    let channel: any;
    if (resolvedClassId) {
      channel = supabase
        .channel(`student-tt-${resolvedClassId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "timetable_entries", filter: `class_id=eq.${resolvedClassId}` }, () => load())
        .subscribe();
    }

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [resolvedClassId]);

  useEffect(() => {
    let mounted = true;
    const fetchSports = async () => {
      if (!studentId) { if (mounted) setSportsActivities([]); return; }
      const { data } = await supabase
        .from("students")
        .select("sports_activities")
        .eq("id", studentId)
        .maybeSingle();
      if (mounted) setSportsActivities((data?.sports_activities as string[]) || []);
    };
    fetchSports();
    return () => { mounted = false; };
  }, [studentId]);

  return (
    <FullWeekTimetable
      entries={entries}
      sportsSchedule={sportsSchedule}
      sportsActivities={sportsActivities}
      loading={loading}
      hasClass={resolvedClassId !== null}
      noClassMessage="No class assignment found for this student yet."
    />
  );
}
