import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserCheck, Loader2, CheckCircle, AlertTriangle, Users } from "lucide-react";
import { errorMessage } from "@/lib/errors";

const formOptions = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const termOptions = ["Term 1", "Term 2", "Term 3"];

function getCurrentTerm(): string {
  const month = new Date().getMonth() + 1;
  return month <= 4 ? "Term 1" : month <= 8 ? "Term 2" : "Term 3";
}

export default function TermRegistration() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [term, setTerm] = useState(getCurrentTerm());
  const [formFilter, setFormFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Tables<"students">[]>([]);
  const [registrations, setRegistrations] = useState<Tables<"term_registrations">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbSubjects, setDbSubjects] = useState<Pick<Tables<"subjects">, "id" | "name" | "department">[]>([]);
  const [feeStructures, setFeeStructures] = useState<Tables<"fee_structures">[]>([]);
  const [dbClasses, setDbClasses] = useState<Tables<"classes">[]>([]);

  // Single student registration dialog
  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Tables<"students"> | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [boardingStatus, setBoardingStatus] = useState("day");
  const [saving, setSaving] = useState(false);

  // Bulk registration
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [studRes, regRes, subRes, feeRes, classRes] = await Promise.all([
      supabase.from("students").select("*").eq("status", "active").order("full_name"),
      supabase.from("term_registrations").select("*").eq("academic_year", academicYear).eq("term", term),
      supabase.from("subjects").select("id, name, department").order("name"),
      supabase.from("fee_structures").select("*").eq("academic_year", academicYear).eq("term", term).eq("is_active", true),
      supabase.from("classes").select("*").order("name"),
    ]);
    setStudents(studRes.data || []);
    setRegistrations(regRes.data || []);
    setDbSubjects(subRes.data || []);
    setFeeStructures(feeRes.data || []);
    setDbClasses(classRes.data || []);
    setLoading(false);
  }, [academicYear, term]);

  useEffect(() => {
    fetchAll();
  }, [academicYear, fetchAll, term]);

  const registeredIds = new Set(registrations.map((r) => r.student_id));

  const filtered = students.filter((s) => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || s.admission_number.toLowerCase().includes(search.toLowerCase());
    const matchForm = formFilter === "all" || s.form === formFilter;
    return matchSearch && matchForm;
  });

  const unregistered = filtered.filter((s) => !registeredIds.has(s.id));
  const registered = filtered.filter((s) => registeredIds.has(s.id));

  function openRegister(student: Tables<"students">) {
    setSelectedStudent(student);
    const currentSubjects = (student.subject_combination || "").split(", ").filter(Boolean);
    setSelectedSubjects(currentSubjects);
    setBoardingStatus(student.boarding_status || "day");
    setRegDialogOpen(true);
  }

  async function registerStudent() {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      // Check if already registered
      const { data: existing } = await supabase
        .from("term_registrations")
        .select("id")
        .eq("student_id", selectedStudent.id)
        .eq("academic_year", academicYear)
        .eq("term", term)
        .maybeSingle();
      if (existing) {
        toast({ title: "Already registered", description: `${selectedStudent.full_name} is already registered for ${term} ${academicYear}.`, variant: "destructive" });
        setSaving(false);
        return;
      }

      // Check if invoice already exists for this term
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id")
        .eq("student_id", selectedStudent.id)
        .eq("academic_year", academicYear)
        .eq("term", term)
        .maybeSingle();

      let invoiceId = existingInv?.id || null;

      // Create invoice from fee structures if none exists
      if (!invoiceId) {
        const applicable = feeStructures.filter(
          (f) => (!f.form || f.form === selectedStudent.form) && (!f.boarding_status || f.boarding_status === boardingStatus)
        );
        if (applicable.length > 0) {
          const totalUsd = applicable.reduce((s, f) => s + Number(f.amount_usd), 0);
          const totalZig = applicable.reduce((s, f) => s + Number(f.amount_zig), 0);
          const invoiceNumber = `INV-${academicYear.slice(-2)}-${term.replace("Term ", "T")}-${Date.now().toString().slice(-5)}`;

          const { data: newInv, error: invErr } = await supabase
            .from("invoices")
            .insert({
              invoice_number: invoiceNumber,
              student_id: selectedStudent.id,
              academic_year: academicYear,
              term: term,
              total_usd: totalUsd,
              total_zig: totalZig,
              paid_usd: 0,
              paid_zig: 0,
              status: "unpaid",
            })
            .select()
            .single();
          if (invErr) throw invErr;
          invoiceId = newInv.id;

          // Create line items
          for (const fee of applicable) {
            await supabase.from("invoice_items").insert({
              invoice_id: invoiceId,
              fee_structure_id: fee.id,
              description: fee.description || `${fee.form} - ${fee.boarding_status === "boarding" ? "Boarding" : "Day"} Fees`,
              amount_usd: fee.amount_usd,
              amount_zig: fee.amount_zig,
            });
          }
        }
      }

      // Create term registration record (status defaults to 'registered')
      const { error: regErr } = await supabase.from("term_registrations").insert({
        student_id: selectedStudent.id,
        academic_year: academicYear,
        term: term,
        status: "registered",
        subjects: selectedSubjects,
        boarding_status: boardingStatus,
        registered_by: user?.id || null,
        invoice_id: invoiceId,
        amount_due: 0,
        amount_paid: 0,
      });
      if (regErr) throw regErr;

      // Update student's subject_combination
      await supabase.from("students").update({ subject_combination: selectedSubjects.join(", "), boarding_status: boardingStatus }).eq("id", selectedStudent.id);

      // Allocate student to class based on form + stream (classes.level holds the form, classes.stream the stream)
      const matchClass = dbClasses.find(c => c.level === selectedStudent.form && (!selectedStudent.stream || c.stream === selectedStudent.stream))
        || dbClasses.find(c => c.level === selectedStudent.form);
      if (matchClass) {
        const { data: existingSc } = await supabase.from("student_classes").select("id").eq("student_id", selectedStudent.id).eq("class_id", matchClass.id).maybeSingle();
        if (!existingSc) {
          await supabase.from("student_classes").insert({ student_id: selectedStudent.id, class_id: matchClass.id });
        }
        const { data: existingEnr } = await supabase.from("enrollments").select("id").eq("student_id", selectedStudent.id).eq("academic_year", academicYear).maybeSingle();
        if (!existingEnr) {
          await supabase.from("enrollments").insert({ student_id: selectedStudent.id, class_id: matchClass.id, academic_year: academicYear });
        }
      }


      toast({ title: "Student registered", description: `${selectedStudent.full_name} registered for ${term} ${academicYear}${invoiceId ? " with invoice created." : "."}` });
      setRegDialogOpen(false);
      fetchAll();
    } catch (err) {
      toast({ title: "Registration failed", description: errorMessage(err), variant: "destructive" });
    }
    setSaving(false);
  }

  async function bulkRegister() {
    setBulkLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const student of unregistered) {
      try {
        const { data: existing } = await supabase
          .from("term_registrations")
          .select("id")
          .eq("student_id", student.id)
          .eq("academic_year", academicYear)
          .eq("term", term)
          .maybeSingle();
        if (existing) continue;

        const bStatus = student.boarding_status || "day";
        const subjects = (student.subject_combination || "").split(", ").filter(Boolean);

        // Check for existing invoice
        const { data: existingInv } = await supabase
          .from("invoices")
          .select("id")
          .eq("student_id", student.id)
          .eq("academic_year", academicYear)
          .eq("term", term)
          .maybeSingle();

        let invoiceId = existingInv?.id || null;

        if (!invoiceId) {
          const applicable = feeStructures.filter(
            (f) => (!f.form || f.form === student.form) && (!f.boarding_status || f.boarding_status === bStatus)
          );
          if (applicable.length > 0) {
            const totalUsd = applicable.reduce((s, f) => s + Number(f.amount_usd), 0);
            const totalZig = applicable.reduce((s, f) => s + Number(f.amount_zig), 0);
            const invoiceNumber = `INV-${academicYear.slice(-2)}-${term.replace("Term ", "T")}-${Date.now().toString().slice(-5)}`;

            const { data: newInv } = await supabase
              .from("invoices")
              .insert({
                invoice_number: invoiceNumber,
                student_id: student.id,
                academic_year: academicYear,
                term: term,
                total_usd: totalUsd,
                total_zig: totalZig,
                paid_usd: 0,
                paid_zig: 0,
                status: "unpaid",
              })
              .select()
              .single();
            if (newInv) {
              invoiceId = newInv.id;
              for (const fee of applicable) {
                await supabase.from("invoice_items").insert({
                  invoice_id: invoiceId,
                  fee_structure_id: fee.id,
                  description: fee.description || `${fee.form} - ${fee.boarding_status === "boarding" ? "Boarding" : "Day"} Fees`,
                  amount_usd: fee.amount_usd,
                  amount_zig: fee.amount_zig,
                });
              }
            }
          }
        }

        await supabase.from("term_registrations").insert({
          student_id: student.id,
          academic_year: academicYear,
          term: term,
          status: "registered",
          subjects: subjects,
          boarding_status: bStatus,
          registered_by: user?.id || null,
          invoice_id: invoiceId,
          amount_due: 0,
          amount_paid: 0,
        });

        // Allocate student to class
        const matchClass = dbClasses.find(c => c.level === student.form && (!student.stream || c.stream === student.stream))
          || dbClasses.find(c => c.level === student.form);
        if (matchClass) {
          const { data: existingSc } = await supabase.from("student_classes").select("id").eq("student_id", student.id).eq("class_id", matchClass.id).maybeSingle();
          if (!existingSc) {
            await supabase.from("student_classes").insert({ student_id: student.id, class_id: matchClass.id });
          }
          const { data: existingEnr } = await supabase.from("enrollments").select("id").eq("student_id", student.id).eq("academic_year", academicYear).maybeSingle();
          if (!existingEnr) {
            await supabase.from("enrollments").insert({ student_id: student.id, class_id: matchClass.id, academic_year: academicYear });
          }
        }


        successCount++;
      } catch {
        errorCount++;
      }
    }

    toast({ title: "Bulk registration complete", description: `${successCount} registered, ${errorCount} errors.` });
    setBulkDialogOpen(false);
    fetchAll();
    setBulkLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Term Registration — {term} {academicYear}
          </CardTitle>
          <CardDescription>
            Register existing students for a new term. Each registration automatically creates one invoice per student per term based on fee structures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Academic Year</Label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["2025", "2026", "2027"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {termOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Form</Label>
              <Select value={formFilter} onValueChange={setFormFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  {formOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or admission number…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <Users className="mr-1 h-4 w-4" /> Bulk Register
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{registered.length}</p>
            <p className="text-xs text-muted-foreground">Registered this term</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{unregistered.length}</p>
            <p className="text-xs text-muted-foreground">Not yet registered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Total active students</p>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Boarding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students found.</TableCell></TableRow>
                ) : (
                  filtered.map((s) => {
                    const isReg = registeredIds.has(s.id);
                    const reg = registrations.find((r) => r.student_id === s.id);
                    return (
                      <TableRow key={s.id} className={isReg ? "bg-emerald-50/50" : ""}>
                        <TableCell className="font-mono text-xs">{s.admission_number}</TableCell>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>{s.form}</TableCell>
                        <TableCell>{s.boarding_status === "boarding" || s.boarding_status === "boarder" ? "Boarding" : "Day"}</TableCell>
                        <TableCell>
                          {isReg ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle className="mr-1 h-3 w-3" /> Registered
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isReg && (
                            <Button size="sm" onClick={() => openRegister(s)}>
                              <UserCheck className="mr-1 h-3.5 w-3.5" /> Register
                            </Button>
                          )}
                          {isReg && reg?.subjects?.length > 0 && (
                            <span className="text-xs text-muted-foreground">{reg.subjects.length} subjects</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Single Registration Dialog */}
      <Dialog open={regDialogOpen} onOpenChange={setRegDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Register for {term} {academicYear}</DialogTitle>
            <DialogDescription>
              {selectedStudent?.full_name} — {selectedStudent?.admission_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Boarding Status</Label>
              <Select value={boardingStatus} onValueChange={setBoardingStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Scholar</SelectItem>
                  <SelectItem value="boarding">Boarder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subjects for this term</Label>
              {dbSubjects.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                  {dbSubjects.map((subj) => (
                    <label key={subj.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-1">
                      <Checkbox
                        checked={selectedSubjects.includes(subj.name)}
                        onCheckedChange={(checked) => {
                          setSelectedSubjects((prev) => checked ? [...prev, subj.name] : prev.filter((s) => s !== subj.name));
                        }}
                      />
                      <span className="text-sm">{subj.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No subjects available.</p>
              )}
              {selectedSubjects.length > 0 && (
                <p className="text-xs text-primary font-medium">{selectedSubjects.length} subject(s) selected</p>
              )}
            </div>

            {/* Fee preview */}
            {feeStructures.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Fee Preview</p>
                {feeStructures
                  .filter((f) => (!f.form || f.form === selectedStudent?.form) && (!f.boarding_status || f.boarding_status === boardingStatus))
                  .map((f) => (
                    <div key={f.id} className="flex justify-between text-sm">
                      <span>{f.description || `${f.form} ${f.boarding_status} fees`}</span>
                      <span className="font-medium">USD {Number(f.amount_usd).toFixed(2)}</span>
                    </div>
                  ))}
                <div className="border-t pt-1 flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span>
                    USD{" "}
                    {feeStructures
                      .filter((f) => (!f.form || f.form === selectedStudent?.form) && (!f.boarding_status || f.boarding_status === boardingStatus))
                      .reduce((s, f) => s + Number(f.amount_usd), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegDialogOpen(false)}>Cancel</Button>
            <Button onClick={registerStudent} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Register & Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Registration Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Bulk Term Registration</DialogTitle>
            <DialogDescription>
              Register all {unregistered.length} unregistered students for {term} {academicYear}. Each will receive an invoice based on fee structures matching their form and boarding status.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              <AlertTriangle className="inline mr-1 h-4 w-4" />
              This will create {unregistered.length} term registrations and up to {unregistered.length} invoices. Existing subjects from each student's profile will be carried forward.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={bulkRegister} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Register All ({unregistered.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
