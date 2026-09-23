import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Sparkles, Trash2, CheckCircle2, Loader2, Download, Users, GraduationCap, BookOpen, Building2, CalendarClock, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAllocation } from "@/contexts/AllocationContext";
import { useDemoPeople } from "@/contexts/DemoPeopleContext";
import { buildCredentialsWorkbook } from "@/lib/credentialsWorkbook";
import { generateDemoSeed, DEMO_PERIODS, DEMO_EMAIL_DOMAIN, DEMO_PASSWORDS, type DemoSeed } from "@/lib/demoSeeder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { TablesInsert } from "@/integrations/supabase/types";

const STEPS = [
  "Generating classes, subjects and venues",
  "Assigning 30 teachers and solving the weekly timetable",
  "Enrolling 500 students across Forms 1–6",
  "Saving the school to the database",
  "Creating login accounts",
  "Linking parents to their children",
  "Publishing to all portals",
];

type Seed = DemoSeed;
type AccountPayload = {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "teacher" | "student" | "parent";
  admission_number?: string;
  children?: { admission_number: string; relationship: string }[];
};

const ACCOUNTS_PER_CALL = 40;
const PARALLEL_CALLS = 3;

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const DEPARTMENT: Record<string, string> = {
  Mathematics: "Mathematics", "Pure Mathematics": "Mathematics",
  "English Language": "Languages", Shona: "Languages",
  "Combined Science": "Sciences", Physics: "Sciences", Chemistry: "Sciences", Biology: "Sciences",
  History: "Humanities", Geography: "Humanities", "Heritage Studies": "Humanities",
  "Computer Science": "Technical", Agriculture: "Technical",
  "Physical Education": "Sports",
  "Principles of Accounting": "Commercials", Accounting: "Commercials", Commerce: "Commercials",
  "Business Studies": "Commercials", Economics: "Commercials",
};

export default function DemoDataSeederPanel() {
  const alloc = useAllocation();
  const people = useDemoPeople();
  const { toast } = useToast();

  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [accountProgress, setAccountProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [summary, setSummary] = useState<null | {
    students: number; parents: number; teachers: number; logins: number; failedLogins: number;
    subjects: number; classes: number; rooms: number; periods: number;
  }>(null);
  const [showSummary, setShowSummary] = useState(false);

  const seeded = people.loadedAt != null;

  /** Subjects, classes, staff, students, class subjects and both timetable views. */
  async function persistSchool(seed: Seed) {
    const year = String(new Date().getFullYear());

    // Subjects — reuse by name.
    const subjectNames = seed.subjects.map((s) => s.name);
    const { data: existingSubs } = await supabase.from("subjects").select("id, name").in("name", subjectNames);
    const subByName = new Map((existingSubs ?? []).map((s) => [s.name, s.id]));
    const missingSubs = seed.subjects.filter((s) => !subByName.has(s.name)).map((s) => ({ name: s.name, is_examinable: s.name !== "Study Hall" }));
    if (missingSubs.length) {
      const { data: ins, error } = await supabase.from("subjects").insert(missingSubs).select("id, name");
      if (error) throw error;
      (ins ?? []).forEach((r) => subByName.set(r.name, r.id));
    }
    const subIdMap = new Map(seed.subjects.map((s) => [s.id, subByName.get(s.name)!]));

    // Classes — before students, so the roster trigger links each student to their class.
    const classNames = seed.classes.map((c) => c.name);
    const { data: existingCls } = await supabase.from("classes").select("id, name").in("name", classNames);
    const clsByName = new Map((existingCls ?? []).map((c) => [c.name, c.id]));
    const classRow = (c: Seed["classes"][number]) => ({
      name: c.name, level: `Form ${c.formLevel}`, stream: c.name.slice(-1), capacity: 40, academic_year: year,
    });
    for (const c of seed.classes.filter((x) => clsByName.has(x.name))) {
      await supabase.from("classes").update(classRow(c)).eq("id", clsByName.get(c.name)!);
    }
    const missingCls = seed.classes.filter((c) => !clsByName.has(c.name)).map(classRow);
    if (missingCls.length) {
      const { data: ins, error } = await supabase.from("classes").insert(missingCls).select("id, name");
      if (error) throw error;
      (ins ?? []).forEach((r) => clsByName.set(r.name, r.id));
    }
    const classIdMap = new Map(seed.classes.map((c) => [c.id, clsByName.get(c.name)!]));

    // Staff — one record per teacher; logins are attached later by email.
    const teacherEmails = seed.teachers.map((t) => t.email);
    const { data: existingStaff } = await supabase.from("staff").select("id, email").in("email", teacherEmails);
    const staffByEmail = new Map((existingStaff ?? []).map((s) => [s.email?.toLowerCase(), s.id]));
    const staffIdMap = new Map<string, string>();
    for (const [i, t] of seed.teachers.entries()) {
      const subjectsTaught = t.qualifiedSubjects.map((sid) => seed.subjects.find((s) => s.id === sid)?.name).filter((n): n is string => !!n);
      const row = {
        full_name: t.name, email: t.email, role: "teacher", category: "teaching", status: "active",
        department: DEPARTMENT[subjectsTaught[0] ?? ""] ?? "Teaching",
        subjects_taught: subjectsTaught,
        phone: `+26377${2000000 + i}`,
      };
      const existing = staffByEmail.get(t.email.toLowerCase());
      if (existing) {
        await supabase.from("staff").update(row).eq("id", existing);
        staffIdMap.set(t.id, existing);
      } else {
        const { data: ins, error } = await supabase.from("staff").insert(row).select("id").single();
        if (error) throw error;
        staffIdMap.set(t.id, ins.id);
      }
    }
    for (const c of seed.classes) {
      const teacher = staffIdMap.get(c.classTeacherId ?? "");
      if (teacher) await supabase.from("classes").update({ class_teacher_id: teacher }).eq("id", classIdMap.get(c.id)!);
    }

    // Students — upserted by admission number so re-seeding keeps their logins.
    // The first parent listed for a family (the mother, or the guardian) is the student's contact.
    const guardianOf = new Map([...seed.parents].reverse().flatMap((p) => p.childIds.map((id) => [id, p] as const)));
    const studentRows = seed.students.map((s) => {
      const [first, ...rest] = s.fullName.split(" ");
      const parent = guardianOf.get(s.id);
      return {
        admission_number: s.admissionNumber,
        full_name: s.fullName,
        first_name: first,
        last_name: rest.join(" "),
        email: s.email,
        date_of_birth: s.dob,
        gender: s.gender,
        form: `Form ${s.form}`,
        stream: s.stream,
        class: `Form ${s.form}${s.stream}`,
        boarding_status: s.boarding ? "boarding" : "day",
        province: s.province,
        address: s.address,
        status: "active",
        enrollment_date: `${year}-01-10`,
        guardian_name: parent?.fullName ?? null,
        guardian_phone: parent?.phone ?? null,
        guardian_email: parent?.email ?? null,
        emergency_contact: parent?.phone ?? null,
      };
    });
    for (const rows of chunk(studentRows, 100)) {
      const { error } = await supabase.from("students").upsert(rows, { onConflict: "admission_number" });
      if (error) throw error;
    }

    // Class subjects (who teaches what, per class).
    const csRows = seed.allocations.map((a) => ({
      class_id: classIdMap.get(a.classId)!,
      subject_id: subIdMap.get(a.subjectId)!,
      teacher_id: staffIdMap.get(a.teacherId) ?? null,
    })).filter((r) => r.class_id && r.subject_id);
    for (const rows of chunk(csRows, 100)) {
      const { error } = await supabase.from("class_subjects").upsert(rows, { onConflict: "class_id,subject_id" });
      if (error) throw error;
    }

    // timetable_entries — the weekly grid used by the student, teacher and parent portals.
    await supabase.from("timetable_entries").delete().eq("term", "DEMO");
    const ttRows = seed.slots.filter((s) => s.subjectId).map((s) => ({
      class_id: classIdMap.get(s.classId)!,
      subject_id: subIdMap.get(s.subjectId!)!,
      teacher_id: staffIdMap.get(s.teacherId!) ?? null,
      day_of_week: s.day,
      start_time: s.startTime,
      end_time: s.endTime,
      room: seed.rooms.find((r) => r.id === s.roomId)?.name ?? null,
      term: "DEMO",
    })).filter((r) => r.class_id && r.subject_id);
    for (const rows of chunk(ttRows, 200)) {
      const { error } = await supabase.from("timetable_entries").insert(rows);
      if (error) throw error;
    }

    // tt_definitions + tt_slots — the published timetable widget.
    await supabase.from("tt_definitions").delete().like("name", "DEMO %");
    const periodToRow: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 8, 7: 9, 8: 10 };
    const breakRows = [
      { period_index: 4, start_time: "09:45", end_time: "10:00", break_label: "Break" },
      { period_index: 7, start_time: "11:30", end_time: "12:00", break_label: "Lunch" },
    ];
    for (const c of seed.classes) {
      const { data: def, error: defErr } = await supabase.from("tt_definitions").insert({
        name: `DEMO ${c.name}`, type: "class", class_label: c.name,
        term: "DEMO", academic_year: year,
        school_days: [1, 2, 3, 4, 5], period_minutes: 45, periods_per_day: 8,
        day_start_time: "07:30", status: "active",
      }).select("id").single();
      if (defErr) throw defErr;

      const slotRows: TablesInsert<"tt_slots">[] = [];
      for (let day = 1; day <= 5; day++) {
        for (const b of breakRows) {
          slotRows.push({ definition_id: def.id, day_of_week: day, ...b, is_break: true });
        }
        for (const s of seed.slots.filter((x) => x.classId === c.id && x.subjectId && x.day === day - 1)) {
          const subj = seed.subjects.find((x) => x.id === s.subjectId);
          slotRows.push({
            definition_id: def.id, day_of_week: day,
            period_index: periodToRow[s.period] ?? s.period,
            start_time: s.startTime, end_time: s.endTime, is_break: false,
            subject_name: subj?.name ?? null, subject_color: subj?.color ?? null,
            teacher_name: seed.teachers.find((x) => x.id === s.teacherId)?.name ?? null,
            room: seed.rooms.find((x) => x.id === s.roomId)?.name ?? null,
          });
        }
      }
      const { error } = await supabase.from("tt_slots").insert(slotRows);
      if (error) throw error;
    }
  }

  /** Every login, created in parallel batches. Parents go last so their children's logins already exist. */
  async function provisionAccounts(seed: Seed): Promise<{ total: number; failed: number }> {
    const admission = new Map(seed.students.map((s) => [s.id, s.admissionNumber]));
    const staffAndStudents: AccountPayload[] = [
      { email: `admin@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORDS.admin, full_name: "Demo Administrator", role: "admin" },
      ...seed.teachers.map((t) => ({ email: t.email, password: DEMO_PASSWORDS.teacher, full_name: t.name, role: "teacher" as const })),
      ...seed.students.map((s) => ({ email: s.email, password: s.password, full_name: s.fullName, role: "student" as const, admission_number: s.admissionNumber })),
    ];
    const parents: AccountPayload[] = seed.parents.map((p) => ({
      email: p.email, password: p.password, full_name: p.fullName, role: "parent",
      children: p.childIds.map((id) => ({ admission_number: admission.get(id)!, relationship: p.relationship })),
    }));
    const total = staffAndStudents.length + parents.length;
    let done = 0;
    let failed = 0;
    setAccountProgress({ done, total, failed });

    const run = async (accounts: AccountPayload[]) => {
      const batches = chunk(accounts, ACCOUNTS_PER_CALL);
      let next = 0;
      const worker = async () => {
        while (next < batches.length) {
          const batch = batches[next++];
          const { data, error } = await supabase.functions.invoke("seed-demo-accounts", { body: { accounts: batch } });
          if (error) failed += batch.length;
          else failed += Number(data?.errors ?? 0);
          done += batch.length;
          setAccountProgress({ done, total, failed });
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_CALLS }, worker));
    };

    await run(staffAndStudents);
    setStepIdx(5);
    await run(parents);
    return { total, failed };
  }

  async function handleLoad() {
    setRunning(true);
    setAccountProgress(null);
    setStepIdx(0);
    const seed = generateDemoSeed();
    setStepIdx(1);
    alloc.replaceAllData({
      teachers: seed.teachers,
      subjects: seed.subjects,
      rooms: seed.rooms,
      classes: seed.classes,
      allocations: seed.allocations,
      slots: seed.slots,
    });
    setStepIdx(2);
    people.setSeed({ students: seed.students, parents: seed.parents });

    try {
      setStepIdx(3);
      await persistSchool(seed);
      setStepIdx(4);
      const { total, failed } = await provisionAccounts(seed);
      setStepIdx(6);

      const summ = {
        students: seed.students.length,
        parents: seed.parents.length,
        teachers: seed.teachers.length,
        logins: total - failed,
        failedLogins: failed,
        subjects: seed.subjects.length,
        classes: seed.classes.length,
        rooms: seed.rooms.length,
        periods: seed.slots.filter((s) => s.subjectId).length,
      };
      setSummary(summ);
      setShowSummary(true);
      toast(failed
        ? { title: "Demo data loaded with some login errors", description: `${failed} of ${total} logins could not be created. Run the seeder again to retry them.`, variant: "destructive" }
        : { title: "Demo data loaded", description: `${summ.students} students, ${summ.parents} parents and ${summ.teachers} teachers can now sign in.` });
    } catch (e) {
      toast({ title: "Loading demo data failed", description: errorMessage(e, "Could not save the demo school"), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  async function handleClear() {
    if (!confirm("Remove all seeded demo data and reset to a clean state? Real data is untouched.")) return;
    const seed = generateDemoSeed();
    alloc.resetToSeed();
    people.clear();
    try { window.localStorage.removeItem("mt_demo_allocation_v2"); } catch { /* storage unavailable */ }
    setSummary(null);
    try {
      const ids: string[] = [];
      for (const nums of chunk(seed.students.map((s) => s.admissionNumber), 100)) {
        const { data } = await supabase.from("students").select("id").in("admission_number", nums);
        ids.push(...(data ?? []).map((r) => r.id));
      }
      // Links without a foreign key to students are removed explicitly.
      for (const part of chunk(ids, 100)) {
        await supabase.from("parent_students").delete().in("student_id", part);
        await supabase.from("parent_student_links").delete().in("student_id", part);
        await supabase.from("access_grants").delete().in("student_id", part).eq("reason", "Demo account");
        await supabase.from("student_classes").delete().in("student_id", part);
        await supabase.from("students").delete().in("id", part);
      }
      await supabase.from("timetable_entries").delete().eq("term", "DEMO");
      await supabase.from("tt_definitions").delete().like("name", "DEMO %");

      // Demo classes go only if no real student is still enrolled in them.
      const { data: classes } = await supabase.from("classes").select("id").in("name", seed.classes.map((c) => c.name));
      const classIds = (classes ?? []).map((c) => c.id);
      const { data: stillUsed } = await supabase.from("student_classes").select("class_id").in("class_id", classIds);
      const busy = new Set((stillUsed ?? []).map((r) => r.class_id));
      const emptyClasses = classIds.filter((id) => !busy.has(id));
      if (emptyClasses.length) {
        await supabase.from("class_subjects").delete().in("class_id", emptyClasses);
        await supabase.from("classes").delete().in("id", emptyClasses);
      }
      await supabase.from("staff").delete().like("email", `%@${DEMO_EMAIL_DOMAIN}`);
      toast({ title: "Demo data cleared", description: "Demo students, classes, staff and timetables were removed. Demo logins stay and are reused on the next load." });
    } catch (e) {
      toast({ title: "Some demo data could not be removed", description: errorMessage(e, "Unknown error"), variant: "destructive" });
    }
  }

  async function downloadCredentials() {
    if (!people.students.length) return;
    try {
      const blob = await buildCredentialsWorkbook({
        schoolName: "MavingTech High School",
        loginUrl: `${window.location.origin}/login`,
        teachers: alloc.teachers,
        subjects: alloc.subjects,
        classes: alloc.classes,
        students: people.students,
        parents: people.parents,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `demo-login-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Could not create the credentials file", description: errorMessage(e), variant: "destructive" });
    }
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
              One-click populate the entire system with realistic Zimbabwean school data (ZIMSEC O-Level and A-Level) — students, parents,
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
                <Button onClick={downloadCredentials} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Login credentials (Excel)
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
              {accountProgress && stepIdx >= 4 && stepIdx < 6 && (
                <p className="text-xs text-muted-foreground">
                  Logins: {accountProgress.done} / {accountProgress.total}
                  {accountProgress.failed > 0 && <span className="text-destructive"> · {accountProgress.failed} failed</span>}
                  {" "}— this takes a few minutes; keep this page open.
                </p>
              )}
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
              <Row label="Students enrolled"   value={summary.students}  hint="Forms 1–4: 3 classes of 35 · Forms 5–6: Sciences and Commercials, 20 each" />
              <Row label="Parents & guardians" value={summary.parents}   hint="Mother and father logins per family (or one guardian); siblings share them" />
              <Row label="Teachers"            value={summary.teachers}  hint="All subjects covered" />
              <Row label="Subjects"            value={summary.subjects}  hint="Linked to relevant forms" />
              <Row label="Classes"             value={summary.classes}   hint="Form 1A–4C, plus Form 5A/5B and Form 6A/6B" />
              <Row label="Venues"              value={summary.rooms}     hint="Classrooms, labs, hall, sports field" />
              <Row label="Login accounts"      value={summary.logins}    hint={summary.failedLogins ? `${summary.failedLogins} failed — run the seeder again to retry` : "Admin, teachers, students and parents — all linked"} />
              <Row label="Timetable periods"   value={summary.periods}   hint="Lessons plus supervised study periods, with teacher, venue and time" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={downloadCredentials} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-1" /> Download login credentials (Excel)
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
