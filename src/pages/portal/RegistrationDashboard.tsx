import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Edit, Eye, LogOut, UserPlus, GraduationCap, Users, Save, Loader2, X
} from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { errorMessage } from "@/lib/errors";

const formOptions = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const streamOptions = ["A", "B", "C", "D", "Arts", "Sciences", "Commercials"];
const genderOptions = ["Male", "Female"];

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  date_of_birth: string | null;
  form: string;
  stream: string | null;
  subject_combination: string | null;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  emergency_contact: string | null;
  medical_conditions: string | null;
  has_medical_alert: boolean;
  address: string | null;
  enrollment_date: string | null;
  status: string;
  created_at: string;
};

type ClassOption = { id: string; name: string; level: string | null; stream: string | null };

const emptyForm = {
  full_name: "",
  date_of_birth: "",
  form: "Grade 8",
  stream: "",
  subject_combination: "",
  gender: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  emergency_contact: "",
  medical_conditions: "",
  has_medical_alert: false,
  address: "",
  enrollment_date: new Date().toISOString().split("T")[0],
};

export default function RegistrationDashboard() {
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formFilter, setFormFilter] = useState("all");

  // Dialog states
  const [showRegister, setShowRegister] = useState(false);
  const [showDetails, setShowDetails] = useState<Student | null>(null);
  const [showClassAssign, setShowClassAssign] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  // Registration form
  const [form, setForm] = useState(emptyForm);

  // Class assignment
  const [selectedClassId, setSelectedClassId] = useState("");
  const [academicYear, setAcademicYear] = useState("2026");

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setStudents(data as any);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name, level, stream").order("name");
    if (data) setClasses(data);
  };

  const handleRegister = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        full_name: form.full_name.trim(),
        form: form.form,
        status: "active",
        enrollment_date: form.enrollment_date || new Date().toISOString().split("T")[0],
      };
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      if (form.stream) payload.stream = form.stream;
      if (form.subject_combination) payload.subject_combination = form.subject_combination;
      if (form.gender) payload.gender = form.gender;
      if (form.guardian_name) payload.guardian_name = form.guardian_name;
      if (form.guardian_phone) payload.guardian_phone = form.guardian_phone;
      if (form.guardian_email) payload.guardian_email = form.guardian_email;
      if (form.emergency_contact) payload.emergency_contact = form.emergency_contact;
      if (form.medical_conditions) payload.medical_conditions = form.medical_conditions;
      if (form.has_medical_alert) payload.has_medical_alert = true;
      if (form.address) payload.address = form.address;

      const { data, error } = await supabase
        .from("students")
        .insert(payload)
        .select("id, admission_number")
        .single();

      if (error) throw error;

      // Fetch auto-assigned class info
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("class_id, classes(name, room)")
        .eq("student_id", data.id)
        .maybeSingle();

      const className = enrollment?.classes?.name || null;
      const room = enrollment?.classes?.room || null;

      toast({
        title: "Student registered successfully!",
        description: className
          ? `${data.admission_number} → Assigned to ${className}${room ? ` (${room})` : ""}`
          : `Student Number: ${data.admission_number}. No matching class found - assign manually.`,
      });
      setShowRegister(false);
      setForm(emptyForm);
      fetchStudents();
    } catch (err) {
      toast({ title: "Registration failed", description: errorMessage(err), variant: "destructive" });
    }
    setSaving(false);
  };

  const handleAssignClass = async () => {
    if (!showClassAssign || !selectedClassId) return;
    setSaving(true);
    try {
      // Check for existing enrollment
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", showClassAssign.id)
        .eq("academic_year", academicYear)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("enrollments")
          .update({ class_id: selectedClassId })
          .eq("id", existing.id);
      } else {
        await supabase.from("enrollments").insert({
          student_id: showClassAssign.id,
          class_id: selectedClassId,
          academic_year: academicYear,
        });
      }

      toast({ title: "Class assigned successfully!" });
      setShowClassAssign(null);
      setSelectedClassId("");
    } catch (err) {
      toast({ title: "Failed to assign class", description: errorMessage(err), variant: "destructive" });
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const filtered = students.filter((s) => {
    const matchSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase());
    const matchForm = formFilter === "all" || s.form === formFilter;
    return matchSearch && matchForm;
  });

  const todayCount = students.filter(
    (s) => s.created_at && s.created_at.startsWith(new Date().toISOString().split("T")[0])
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={schoolLogo} alt="MHS" className="h-16 w-16 sm:h-20 sm:w-20 object-contain" />
            <div>
              <h1 className="font-heading text-sm sm:text-lg font-bold text-primary">Registration Portal</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">MavingTech High School</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs sm:text-sm">
            <LogOut className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="container px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-accent/10 p-3">
                <UserPlus className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Registered Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-secondary p-3">
                <GraduationCap className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classes.length}</p>
                <p className="text-xs text-muted-foreground">Classes Available</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions & Filters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg">Student Registration</CardTitle>
            <Button onClick={() => { setForm(emptyForm); setShowRegister(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Register New Student
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={formFilter} onValueChange={setFormFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  {formOptions.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student #</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono font-medium">{s.admission_number}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>{s.form}</TableCell>
                          <TableCell>{s.stream || "—"}</TableCell>
                          <TableCell>{s.gender || "—"}</TableCell>
                          <TableCell className="text-sm">{s.guardian_name || "—"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => setShowDetails(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowClassAssign(s); setSelectedClassId(""); }}>
                              Assign Class
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Register Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Register New Student</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Student full name" />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {genderOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Form *</Label>
              <Select value={form.form} onValueChange={(v) => setForm({ ...form, form: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Stream</Label>
              <Select value={form.stream} onValueChange={(v) => setForm({ ...form, stream: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {streamOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject Combination</Label>
              <Input value={form.subject_combination} onChange={(e) => setForm({ ...form, subject_combination: e.target.value })} placeholder="e.g. Maths, Physics, Chemistry" />
            </div>
            <div className="space-y-1">
              <Label>Enrollment Date</Label>
              <Input type="date" value={form.enrollment_date} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Home address" />
            </div>

            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">Guardian / Parent Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Guardian Name</Label>
                  <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} placeholder="Parent/Guardian name" />
                </div>
                <div className="space-y-1">
                  <Label>Guardian Phone</Label>
                  <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="+263 7X XXX XXXX" />
                </div>
                <div className="space-y-1">
                  <Label>Guardian Email</Label>
                  <Input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Emergency Contact</Label>
                  <Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Emergency phone" />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">Medical Information</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Medical Conditions</Label>
                  <Textarea value={form.medical_conditions} onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })} placeholder="Any known conditions, allergies, etc." rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.has_medical_alert}
                    onCheckedChange={(c) => setForm({ ...form, has_medical_alert: !!c })}
                  />
                  <Label className="text-sm">Flag as medical alert</Label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Register Student
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      <Dialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Student Details</DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Student #:</span> <strong className="font-mono">{showDetails.admission_number}</strong></div>
                <div><span className="text-muted-foreground">Name:</span> <strong>{showDetails.full_name}</strong></div>
                <div><span className="text-muted-foreground">Form:</span> {showDetails.form}</div>
                <div><span className="text-muted-foreground">Stream:</span> {showDetails.stream || "—"}</div>
                <div><span className="text-muted-foreground">Gender:</span> {showDetails.gender || "—"}</div>
                <div><span className="text-muted-foreground">DOB:</span> {showDetails.date_of_birth || "—"}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={showDetails.status === "active" ? "default" : "secondary"}>{showDetails.status}</Badge></div>
                <div><span className="text-muted-foreground">Enrolled:</span> {showDetails.enrollment_date || "—"}</div>
              </div>
              <div className="border-t pt-2">
                <p className="font-semibold mb-1">Guardian</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Name:</span> {showDetails.guardian_name || "—"}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {showDetails.guardian_phone || "—"}</div>
                  <div><span className="text-muted-foreground">Email:</span> {showDetails.guardian_email || "—"}</div>
                  <div><span className="text-muted-foreground">Emergency:</span> {showDetails.emergency_contact || "—"}</div>
                </div>
              </div>
              {showDetails.medical_conditions && (
                <div className="border-t pt-2">
                  <p className="font-semibold mb-1">Medical</p>
                  <p>{showDetails.medical_conditions}</p>
                  {showDetails.has_medical_alert && <Badge variant="destructive" className="mt-1">Medical Alert</Badge>}
                </div>
              )}
              <div className="border-t pt-2">
                <div><span className="text-muted-foreground">Address:</span> {showDetails.address || "—"}</div>
                <div><span className="text-muted-foreground">Subject Combination:</span> {showDetails.subject_combination || "—"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Class Dialog */}
      <Dialog open={!!showClassAssign} onOpenChange={() => setShowClassAssign(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Assign Class</DialogTitle>
          </DialogHeader>
          {showClassAssign && (
            <div className="space-y-4">
              <p className="text-sm">
                Assign <strong>{showClassAssign.full_name}</strong> ({showClassAssign.admission_number}) to a class.
              </p>
              <div className="space-y-1">
                <Label>Academic Year</Label>
                <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026" />
              </div>
              <div className="space-y-1">
                <Label>Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.level ? `(${c.level})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowClassAssign(null)}>Cancel</Button>
                <Button onClick={handleAssignClass} disabled={saving || !selectedClassId}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
