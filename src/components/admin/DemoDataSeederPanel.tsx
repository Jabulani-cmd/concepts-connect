import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Sparkles, Trash2, CheckCircle2, Loader2, Download, Users, GraduationCap, BookOpen, Building2, CalendarClock, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllocation } from "@/contexts/AllocationContext";
import { useDemoPeople } from "@/contexts/DemoPeopleContext";
import { generateDemoSeed, DEMO_PERIODS } from "@/lib/demoSeeder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const STEPS = [
  "Generating venues and classrooms",
  "Creating subjects and curriculum",
  "Provisioning teacher accounts",
  "Enrolling 150 learners across Grade 8–12",
  "Assigning 300 parents and guardians",
  "Building class allocations",
  "Solving weekly timetable",
  "Provisioning login accounts (admin + teachers)",
  "Publishing to all portals",
];

export default function DemoDataSeederPanel() {
  const alloc = useAllocation();
  const people = useDemoPeople();
  const { toast } = useToast();

  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [summary, setSummary] = useState<null | {
    students: number; parents: number; teachers: number;
    subjects: number; classes: number; rooms: number; periods: number;
  }>(null);
  const [showSummary, setShowSummary] = useState(false);

  const seeded = people.loadedAt != null;

  async function provisionAuthAccounts(seed: ReturnType<typeof generateDemoSeed>) {
    const adminAcct = { email: "admin@schooldemo.com", password: "Demo@2025", full_name: "Demo Administrator", role: "admin" as const };
    const teacherAccts = seed.teachers.map(t => ({
      email: t.email, password: "Teacher@2025", full_name: t.name, role: "teacher" as const,
    }));
    const studentAccts = seed.students.map(s => ({
      email: s.email, password: s.password, full_name: s.fullName, role: "student" as const,
    }));
    const parentAccts = seed.parents.map(p => ({
      email: p.email, password: p.password, full_name: p.fullName, role: "parent" as const,
    }));

    // Phase 1 (blocking): admin + teachers so the demo can log in immediately.
    const priority = [adminAcct, ...teacherAccts];
    const { error: e1 } = await supabase.functions.invoke("seed-demo-accounts", { body: { accounts: priority } });
    if (e1) throw e1;

    // Phase 2 (background): students + parents in chunks of 50.
    const rest = [...studentAccts, ...parentAccts];
    (async () => {
      for (let i = 0; i < rest.length; i += 50) {
        const chunk = rest.slice(i, i + 50);
        try { await supabase.functions.invoke("seed-demo-accounts", { body: { accounts: chunk } }); }
        catch (err) { console.error("seed-demo-accounts chunk failed", err); }
      }
      toast({ title: "All demo logins ready", description: `Students & parents provisioned (${rest.length} accounts).` });
    })();
  }

  async function persistStudentsToDb(seed: ReturnType<typeof generateDemoSeed>) {
    // Insert seeded students into the DB so they appear in the Admin → Students section
    // (which reads from the `students` table). Logged-in admin satisfies RLS.
    const rows = seed.students.map(s => {
      const [first, ...rest] = s.fullName.split(" ");
      const last = rest.join(" ");
      const parent = seed.parents.find(p => p.studentId === s.id);
      return {
        admission_number: s.admissionNumber,
        full_name: s.fullName,
        first_name: first,
        last_name: last,
        email: s.email,
        date_of_birth: s.dob,
        gender: s.gender,
        form: `Grade ${s.form}`,
        stream: s.stream,
        class: `Grade ${s.form}${s.stream}`,
        boarding_status: "day",
        status: "active",
        guardian_name: parent?.fullName ?? null,
        guardian_phone: parent?.phone ?? null,
        guardian_email: parent?.email ?? null,
      };
    });
    // Chunk to keep request size small.
    for (let i = 0; i < rows.length; i += 60) {
      const chunk = rows.slice(i, i + 60);
      const { error } = await supabase
        .from("students")
        .upsert(chunk, { onConflict: "admission_number" });
      if (error) throw error;
    }
  }

  async function persistTimetableToDb(seed: ReturnType<typeof generateDemoSeed>) {
    // 1) Subjects — upsert by name
    const subjectNames = seed.subjects.map(s => s.name);
    const { data: existingSubs } = await supabase.from("subjects").select("id, name").in("name", subjectNames);
    const subByName = new Map((existingSubs ?? []).map(s => [s.name, s.id]));
    const missingSubs = seed.subjects.filter(s => !subByName.has(s.name)).map(s => ({ name: s.name, is_examinable: true }));
    if (missingSubs.length) {
      const { data: ins } = await supabase.from("subjects").insert(missingSubs).select("id, name");
      (ins ?? []).forEach(r => subByName.set(r.name, r.id));
    }
    const subIdMap = new Map(seed.subjects.map(s => [s.id, subByName.get(s.name)!]));

    // 2) Classes — upsert by name
    const classNames = seed.classes.map(c => c.name);
    const { data: existingCls } = await supabase.from("classes").select("id, name").in("name", classNames);
    const clsByName = new Map((existingCls ?? []).map(c => [c.name, c.id]));
    const missingCls = seed.classes.filter(c => !clsByName.has(c.name)).map(c => ({
      name: c.name, level: `Grade ${c.name.match(/\d+/)?.[0] ?? ""}`, stream: c.stream, capacity: 40,
      academic_year: String(new Date().getFullYear()),
    }));
    if (missingCls.length) {
      const { data: ins } = await supabase.from("classes").insert(missingCls).select("id, name");
      (ins ?? []).forEach(r => clsByName.set(r.name, r.id));
    }
    const classIdMap = new Map(seed.classes.map(c => [c.id, clsByName.get(c.name)!]));

    // 3) Staff — link to auth user via profiles.email, then upsert staff per teacher
    const teacherEmails = seed.teachers.map(t => t.email);
    const { data: profs } = await supabase.from("profiles").select("id, email").in("email", teacherEmails);
    const uidByEmail = new Map((profs ?? []).map(p => [p.email?.toLowerCase(), p.id]));

    const { data: existingStaff } = await supabase.from("staff").select("id, email, user_id").in("email", teacherEmails);
    const staffByEmail = new Map((existingStaff ?? []).map(s => [s.email?.toLowerCase(), s]));

    // Department mapping (first qualified subject → dept name)
    const DEPT: Record<string, string> = {
      Mathematics: "Mathematics", English: "Languages", Shona: "Languages", Ndebele: "Languages",
      Physics: "Sciences", Chemistry: "Sciences", Biology: "Sciences",
      History: "Humanities", Geography: "Humanities", "Religious Studies": "Humanities",
      "Computer Science": "Technical", "Technical Graphics": "Technical", Agriculture: "Technical",
      "Physical Education": "Sports", Art: "Arts", Music: "Arts",
      Accounts: "Commercials", Commerce: "Commercials", Business: "Commercials",
    };
    const deptFor = (t: any) => {
      const subName = seed.subjects.find(s => s.id === t.qualifiedSubjects?.[0])?.name ?? "";
      return DEPT[subName] ?? "Teaching";
    };

    const staffIdMap = new Map<string, string>();
    for (const t of seed.teachers) {
      const key = t.email.toLowerCase();
      const uid = uidByEmail.get(key) ?? null;
      const existing = staffByEmail.get(key);
      const subjectsTaught = t.qualifiedSubjects.map(sid => seed.subjects.find(s => s.id === sid)?.name).filter(Boolean);
      const dept = deptFor(t);
      if (existing) {
        staffIdMap.set(t.id, existing.id);
        await supabase.from("staff").update({
          user_id: uid ?? existing.user_id ?? null,
          role: "teacher", department: dept,
          category: "teaching", status: "active",
          subjects_taught: subjectsTaught,
        }).eq("id", existing.id);
      } else {
        const { data: ins, error } = await supabase.from("staff").insert({
          full_name: t.name, email: t.email, user_id: uid,
          role: "teacher", department: dept,
          category: "teaching", status: "active",
          subjects_taught: subjectsTaught,
        }).select("id").single();
        if (!error && ins) staffIdMap.set(t.id, ins.id);
        else if (error) console.error("staff insert failed", t.email, error);
      }
    }

    // 4) Patch class_teacher_id on classes
    for (const c of seed.classes) {
      const dbCls = classIdMap.get(c.id);
      const dbStaff = staffIdMap.get(c.classTeacherId ?? "");
      if (dbCls && dbStaff) {
        await supabase.from("classes").update({ class_teacher_id: dbStaff }).eq("id", dbCls);
      }
    }

    // 5) class_subjects — upsert (class_id, subject_id, teacher_id)
    const csRows = seed.allocations.map(a => ({
      class_id: classIdMap.get(a.classId)!,
      subject_id: subIdMap.get(a.subjectId)!,
      teacher_id: staffIdMap.get(a.teacherId) ?? null,
    })).filter(r => r.class_id && r.subject_id);
    for (let i = 0; i < csRows.length; i += 100) {
      const chunk = csRows.slice(i, i + 100);
      await supabase.from("class_subjects").upsert(chunk, { onConflict: "class_id,subject_id" });
    }

    // 6) timetable_entries — wipe demo term then insert (FullWeekTimetable widget)
    await supabase.from("timetable_entries").delete().eq("term", "DEMO");
    const ttRows = seed.slots.filter(s => s.subjectId).map(s => {
      const room = seed.rooms.find(r => r.id === s.roomId);
      return {
        class_id: classIdMap.get(s.classId)!,
        subject_id: subIdMap.get(s.subjectId!)!,
        teacher_id: staffIdMap.get(s.teacherId!) ?? null,
        day_of_week: s.day,
        start_time: s.startTime,
        end_time: s.endTime,
        room: room?.name ?? null,
        term: "DEMO",
      };
    }).filter(r => r.class_id && r.subject_id);
    for (let i = 0; i < ttRows.length; i += 100) {
      const chunk = ttRows.slice(i, i + 100);
      await supabase.from("timetable_entries").insert(chunk);
    }

    // 7) tt_definitions + tt_slots — PublishedTimetableWidget across all portals
    await supabase.from("tt_definitions").delete().like("name", "DEMO %");
    // period 1..8 → visible row index (4=Break, 7=Lunch)
    const periodToRow: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 8, 7: 9, 8: 10 };
    const breakRows = [
      { period_index: 4, start_time: "09:45", end_time: "10:00", break_label: "Break" },
      { period_index: 7, start_time: "11:30", end_time: "12:00", break_label: "Lunch" },
    ];
    for (const c of seed.classes) {
      const dbClsId = classIdMap.get(c.id);
      if (!dbClsId) continue;
      const { data: def, error: defErr } = await supabase.from("tt_definitions").insert({
        name: `DEMO ${c.name}`, type: "class", class_label: c.name,
        term: "DEMO", academic_year: String(new Date().getFullYear()),
        school_days: [1, 2, 3, 4, 5], period_minutes: 45, periods_per_day: 8,
        day_start_time: "07:30", status: "active",
      }).select("id").single();
      if (defErr || !def) { console.error("tt_definitions insert failed", c.name, defErr); continue; }

      const classSlots = seed.slots.filter(s => s.classId === c.id && s.subjectId);
      const slotRows: any[] = [];
      for (let day = 1; day <= 5; day++) {
        for (const b of breakRows) {
          slotRows.push({
            definition_id: def.id, day_of_week: day, period_index: b.period_index,
            start_time: b.start_time, end_time: b.end_time,
            is_break: true, break_label: b.break_label,
          });
        }
        for (const s of classSlots.filter(x => x.day === day - 1)) {
          const subj = seed.subjects.find(x => x.id === s.subjectId);
          const teach = seed.teachers.find(x => x.id === s.teacherId);
          const room = seed.rooms.find(x => x.id === s.roomId);
          slotRows.push({
            definition_id: def.id, day_of_week: day,
            period_index: periodToRow[s.period] ?? s.period,
            start_time: s.startTime, end_time: s.endTime, is_break: false,
            subject_name: subj?.name ?? null, subject_color: subj?.color ?? null,
            teacher_name: teach?.name ?? null, room: room?.name ?? null,
          });
        }
      }
      for (let i = 0; i < slotRows.length; i += 100) {
        await supabase.from("tt_slots").insert(slotRows.slice(i, i + 100));
      }
    }
  }

  async function handleLoad() {
    setRunning(true);
    setStepIdx(0);
    for (let i = 0; i < 7; i++) {
      await new Promise(r => setTimeout(r, 300));
      setStepIdx(i + 1);
    }
    const seed = generateDemoSeed();
    alloc.replaceAllData({
      teachers: seed.teachers,
      subjects: seed.subjects,
      rooms: seed.rooms,
      classes: seed.classes,
      allocations: seed.allocations,
      slots: seed.slots,
    });
    people.setSeed({ students: seed.students, parents: seed.parents });

    setStepIdx(7);
    try {
      await persistStudentsToDb(seed);
    } catch (e: any) {
      toast({ title: "Saving students failed", description: e?.message || "Could not save students to the database", variant: "destructive" });
    }
    try {
      await provisionAuthAccounts(seed);
    } catch (e: any) {
      toast({ title: "Account provisioning failed", description: e?.message || "Could not create login accounts", variant: "destructive" });
    }
    // Auth accounts must exist before we can link staff.user_id via profiles email.
    try {
      await persistTimetableToDb(seed);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Saving timetable failed", description: e?.message || "Could not save classes/timetable to the database", variant: "destructive" });
    }
    setStepIdx(8);
    await new Promise(r => setTimeout(r, 300));

    const summ = {
      students: seed.students.length,
      parents: seed.parents.length,
      teachers: seed.teachers.length,
      subjects: seed.subjects.length,
      classes: seed.classes.length,
      rooms: seed.rooms.length,
      periods: seed.slots.filter(s => s.subjectId).length,
    };
    setSummary(summ);
    setShowSummary(true);
    setRunning(false);
    toast({ title: "Demo data loaded", description: `Admin + ${summ.teachers} teachers can log in now. Students & parents finishing in background.` });
  }

  async function handleClear() {
    if (!confirm("Remove all seeded demo data and reset to a clean state? Real data is untouched.")) return;
    alloc.resetToSeed();
    people.clear();
    try { window.localStorage.removeItem("mt_demo_allocation_v1"); } catch {}
    setSummary(null);
    // Remove demo data from DB
    try {
      await supabase.from("students").delete().like("admission_number", "STU%");
      await supabase.from("timetable_entries").delete().eq("term", "DEMO");
      await supabase.from("tt_definitions").delete().like("name", "DEMO %");
      await supabase.from("class_subjects").delete().in("class_id",
        (await supabase.from("classes").select("id").like("name", "Grade %")).data?.map(r => r.id) ?? []);
      await supabase.from("classes").delete().like("name", "Grade %");
      await supabase.from("staff").delete().like("email", "%@schooldemo.com");
    } catch (e) {
      console.error("Failed clearing demo data from DB", e);
    }
    toast({ title: "Demo data cleared", description: "Application reset to a clean state." });
  }

  function downloadCredentialsCsv() {
    if (!people.students.length) return;
    const lines = ["role,full_name,reference,email,password"];
    lines.push(`admin,"Administrator","Full access",admin@schooldemo.com,Demo@2025`);
    alloc.teachers.forEach(t => lines.push(`teacher,"${t.name}","${t.employeeNumber}",${t.email},Teacher@2025`));
    people.students.forEach(s => lines.push(`student,"${s.fullName}","${s.admissionNumber} • Grade ${s.form}${s.stream}",${s.email},${s.password}`));
    people.parents.forEach(p => {
      const child = people.students.find(s => s.id === p.studentId);
      lines.push(`parent (${p.relationship}),"${p.fullName}","Child: ${child?.fullName ?? ""}",${p.email},${p.password}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "demo-credentials.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const stats = [
    { icon: GraduationCap, label: "Students",  value: people.students.length, color: "text-blue-600" },
    { icon: UserCog,       label: "Parents",   value: people.parents.length,  color: "text-purple-600" },
    { icon: Users,         label: "Teachers",  value: seeded ? alloc.teachers.length : 0, color: "text-emerald-600" },
    { icon: BookOpen,      label: "Subjects",  value: seeded ? alloc.subjects.length : 0, color: "text-amber-600" },
    { icon: Building2,     label: "Classes",   value: seeded ? alloc.classes.length  : 0, color: "text-rose-600" },
    { icon: CalendarClock, label: "Periods",   value: seeded ? alloc.slots.filter(s => s.subjectId).length : 0, color: "text-cyan-600" },
  ];

  return (
    <>
      <Card className="border-2 border-cyan-200 dark:border-cyan-900 bg-gradient-to-br from-cyan-50/60 via-background to-teal-50/40 dark:from-cyan-950/30 dark:to-teal-950/20">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan-600" />
              Demo Data Seeder
              <Badge variant="outline" className="ml-2 border-cyan-300 text-cyan-700 dark:text-cyan-300">Demo</Badge>
              {seeded && <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Loaded</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              One-click populate the entire system with realistic South African CAPS-aligned school data — students, parents,
              teachers, subjects, classes, venues and a complete weekly timetable.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleLoad} disabled={running} className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90">
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {seeded ? "Re-seed Demo Data" : "Load Demo Data"}
            </Button>
            {seeded && (
              <>
                <Button onClick={downloadCredentialsCsv} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Credentials CSV
                </Button>
                <Button onClick={handleClear} variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Clear Demo Data
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {running && (
            <div className="space-y-3 mb-4">
              <Progress value={((stepIdx + 1) / STEPS.length) * 100} />
              <div className="space-y-1.5">
                {STEPS.map((s, i) => (
                  <motion.div key={s} initial={{ opacity: 0 }} animate={{ opacity: i <= stepIdx ? 1 : 0.4 }}
                    className="flex items-center gap-2 text-sm">
                    {i < stepIdx ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                      i === stepIdx ? <Loader2 className="h-4 w-4 animate-spin text-cyan-600" /> :
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                    <span>{s}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-lg border bg-background/80 p-3">
                <div className={`flex items-center gap-2 ${color}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">{value}</div>
              </div>
            ))}
          </div>

          {seeded && (
            <p className="text-xs text-muted-foreground mt-3">
              Loaded {new Date(people.loadedAt!).toLocaleString()} — visible across student, teacher, parent and admin portals.
              School day: {DEMO_PERIODS[0].start}–{DEMO_PERIODS[DEMO_PERIODS.length - 1].end}, {DEMO_PERIODS.length} periods × 45 min, break after P3, lunch after P5.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Demo data loaded successfully
            </DialogTitle>
            <DialogDescription>
              The entire system has been populated and the timetable is live across every portal.
            </DialogDescription>
          </DialogHeader>
          {summary && (
            <div className="space-y-2 text-sm">
              <Row label="Students enrolled"   value={summary.students}  hint="Grade 8–12, 30 per form, 15 per stream" />
              <Row label="Parents & guardians" value={summary.parents}   hint="2 per student with portal logins" />
              <Row label="Teachers"            value={summary.teachers}  hint="All subjects covered" />
              <Row label="Subjects"            value={summary.subjects}  hint="Linked to relevant forms" />
              <Row label="Classes"             value={summary.classes}   hint="Grade 8A through Grade 12B" />
              <Row label="Venues"              value={summary.rooms}     hint="Classrooms, labs, hall, sports field" />
              <Row label="Timetable periods"   value={summary.periods}   hint="Every slot filled with subject, teacher, venue, time" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={downloadCredentialsCsv} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-1" /> Download credentials CSV
            </Button>
            <Button onClick={() => setShowSummary(false)} className="flex-1">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
    </div>
  );
}
