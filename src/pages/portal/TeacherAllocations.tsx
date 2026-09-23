import { useState, useMemo } from "react";
import { useAllocation } from "@/contexts/AllocationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Users, BookOpen, AlertTriangle, CheckCircle2, GraduationCap, MapPin, type LucideIcon } from "lucide-react";
import TimetableGrid from "@/components/allocation/TimetableGrid";

export default function TeacherAllocations() {
  const {
    teachers, subjects, classes, allocations, rooms, slots,
    setAllocation, removeAllocation,
  } = useAllocation();
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");

  const currentClass = classes.find((c) => c.id === selectedClass);

  const stats = useMemo(() => {
    let total = 0, allocated = 0;
    const partial: string[] = [];
    classes.forEach((c) => {
      const need = c.subjects.length;
      const have = allocations.filter((a) => a.classId === c.id).length;
      total += need;
      allocated += have;
      if (have > 0 && have < need) partial.push(c.id);
    });
    const fullyAllocated = classes.filter((c) =>
      allocations.filter((a) => a.classId === c.id).length === c.subjects.length
    ).length;
    const teacherLoad = teachers.map((t) => {
      const periods = allocations
        .filter((a) => a.teacherId === t.id)
        .reduce((sum, a) => sum + a.periodsPerWeek, 0);
      return { ...t, periods, pct: Math.round((periods / t.maxPeriodsPerWeek) * 100) };
    });
    return {
      totalClasses: classes.length,
      fullyAllocated,
      partial: partial.length,
      unresolved: total - allocated,
      atCapacity: teacherLoad.filter((t) => t.pct >= 90).length,
      underutilized: teacherLoad.filter((t) => t.pct < 50).length,
      teacherLoad,
    };
  }, [classes, allocations, teachers]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Teacher Allocations</h1>
          <p className="text-muted-foreground text-sm">
            Assign teachers to class–subjects. Every timetable slot shows Period, Subject, Teacher and Venue.
          </p>
        </div>
        <Badge variant="secondary" className="bg-amber-100 text-amber-900 border border-amber-300">
          DEMO MODE — in-memory data
        </Badge>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Classes" value={stats.totalClasses} icon={GraduationCap} />
        <StatCard label="Fully Allocated" value={stats.fullyAllocated} icon={CheckCircle2} tone="success" />
        <StatCard label="Partially Allocated" value={stats.partial} icon={BookOpen} tone="warning" />
        <StatCard label="Unallocated Subjects" value={stats.unresolved} icon={AlertTriangle} tone="danger" />
        <StatCard label="At Capacity" value={stats.atCapacity} icon={Users} tone="warning" />
        <StatCard label="Underutilized" value={stats.underutilized} icon={Users} />
      </div>

      <Tabs defaultValue="allocations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="timetable">Class Timetable</TabsTrigger>
          <TabsTrigger value="teachers">Teacher Profiles</TabsTrigger>
          <TabsTrigger value="rooms">Venues</TabsTrigger>
        </TabsList>

        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Class allocation progress</CardTitle>
              <CardDescription>Track how many subjects have a teacher per class.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classes.map((c) => {
                const have = allocations.filter((a) => a.classId === c.id).length;
                const pct = Math.round((have / c.subjects.length) * 100);
                const tone = pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={c.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name} <span className="text-muted-foreground">• Form {c.formLevel} • {c.stream}</span></span>
                      <span className="tabular-nums text-muted-foreground">{have}/{c.subjects.length} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="font-heading text-lg">Manual allocation</CardTitle>
                <CardDescription>Pick the qualified teacher for each subject in a class.</CardDescription>
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {currentClass && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Periods / week</TableHead>
                        <TableHead>Room type</TableHead>
                        <TableHead>Assigned teacher</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentClass.subjects.map((cs) => {
                        const subj = subjects.find((s) => s.id === cs.subjectId)!;
                        const alloc = allocations.find((a) => a.classId === currentClass.id && a.subjectId === cs.subjectId);
                        const qualified = teachers.filter((t) =>
                          t.qualifiedSubjects.includes(cs.subjectId) && t.qualifiedForms.includes(currentClass.formLevel)
                        );
                        return (
                          <TableRow key={cs.subjectId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: subj.color }} />
                                {subj.name}
                              </div>
                            </TableCell>
                            <TableCell>{cs.periodsPerWeek}</TableCell>
                            <TableCell><Badge variant="outline">{cs.roomType}</Badge></TableCell>
                            <TableCell>
                              <Select
                                value={alloc?.teacherId ?? ""}
                                onValueChange={(v) => setAllocation(currentClass.id, cs.subjectId, v)}
                              >
                                <SelectTrigger className="w-56">
                                  <SelectValue placeholder={qualified.length ? "Select teacher" : "No qualified teacher"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {qualified.map((t) => {
                                    const load = allocations.filter((a) => a.teacherId === t.id).reduce((sum, a) => sum + a.periodsPerWeek, 0);
                                    return (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name} ({load}/{t.maxPeriodsPerWeek} pds)
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              {alloc && (
                                <Button variant="ghost" size="sm" onClick={() => removeAllocation(alloc.id)}>
                                  Clear
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-heading text-lg font-semibold">Class master timetable</h3>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedClass && <TimetableGrid classId={selectedClass} />}
        </TabsContent>

        <TabsContent value="teachers" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Teaching profiles & workload</CardTitle>
              <CardDescription>Qualifications, employment type and current allocation load.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qualified subjects</TableHead>
                    <TableHead>Grades</TableHead>
                    <TableHead className="w-[200px]">Workload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.teacherLoad.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}<div className="text-xs text-muted-foreground">{t.employeeNumber}</div></TableCell>
                      <TableCell><Badge variant="outline">{t.employmentType}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.qualifiedSubjects.map((sid) => {
                            const s = subjects.find((x) => x.id === sid);
                            return s && <Badge key={sid} variant="secondary" className="text-[10px]">{s.name}</Badge>;
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{t.qualifiedForms.join(", ")}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{t.periods}/{t.maxPeriodsPerWeek} pds</span>
                            <span className={t.pct >= 90 ? "text-red-600" : t.pct >= 50 ? "text-amber-600" : "text-muted-foreground"}>{t.pct}%</span>
                          </div>
                          <Progress value={Math.min(t.pct, 100)} className="h-1.5" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Venues</CardTitle>
              <CardDescription>Rooms available for scheduling.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {rooms.map((r) => {
                  const usage = slots.filter((s) => s.roomId === r.id).length;
                  return (
                    <Card key={r.id} className="p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{r.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.type} • capacity {r.capacity}
                      </div>
                      <div className="mt-2 text-xs">Used: <span className="font-medium">{usage}</span> periods/week</div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone?: "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    tone === "warning" ? "text-amber-700 bg-amber-50 border-amber-200" :
    tone === "danger" ? "text-red-700 bg-red-50 border-red-200" :
    "text-primary bg-primary/5 border-primary/20";
  return (
    <Card className={`p-3 border ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="font-heading text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
