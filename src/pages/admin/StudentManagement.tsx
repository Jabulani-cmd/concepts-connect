import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, Eye, Upload, Download, AlertTriangle, User, Users, Copy, Camera, KeyRound, UserCheck } from "lucide-react";
import TermRegistration from "@/components/admin/TermRegistration";
import { studentFormSchema, type StudentFormData } from "@/lib/validators";
import ImageCropper from "@/components/ImageCropper";
import WebcamCapture from "@/components/WebcamCapture";
import { errorMessage } from "@/lib/errors";
import { DEFAULT_FORM, FORM_LEVELS } from "@/lib/forms";

const streamOptions = ["A", "B", "C", "D", "Arts", "Sciences", "Commercials"];
const statusOptions = ["active", "graduated", "withdrawn"];
const genderOptions = ["Male", "Female"];

type Student = Tables<"students">;

const sportsOptions = ["Rugby", "Soccer", "Cricket", "Tennis", "Athletics", "Swimming", "Volleyball", "Basketball", "Hockey", "Netball", "Chess", "Table Tennis"];

const emptyForm: StudentFormData = {
  admission_number: "",
  full_name: "",
  date_of_birth: "",
  form: DEFAULT_FORM,
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
  status: "active",
  sports_activities: [],
  boarding_status: "day",
};

export default function StudentManagement() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterForm, setFilterForm] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Photo upload
  const photoRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<{ id: string; name: string; department: string | null }[]>([]);
  const [provisionResult, setProvisionResult] = useState<{ email: string; temp_password: string; admission_number: string; parent?: { email: string; temp_password: string | null; existed: boolean } | null } | null>(null);
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);

  // Boarding fields
  const [hostels, setHostels] = useState<Pick<Tables<"hostels">, "id" | "name" | "capacity">[]>([]);
  const [rooms, setRooms] = useState<Pick<Tables<"rooms">, "id" | "hostel_id" | "room_number" | "room_type" | "capacity">[]>([]);
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<string[]>([]);
  const [selectedHostel, setSelectedHostel] = useState("");
  const [selectedDormitoryType, setSelectedDormitoryType] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [bedNumber, setBedNumber] = useState("");

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("id, name, department").order("name");
    if (data) setDbSubjects(data);
  };

  const fetchBoardingData = async () => {
    const [h, r, a] = await Promise.all([
      supabase.from("hostels").select("id, name, capacity").eq("is_active", true).order("name"),
      supabase.from("rooms").select("id, hostel_id, room_number, room_type, capacity").order("room_number"),
      supabase.from("bed_allocations").select("room_id").eq("status", "active"),
    ]);
    if (h.data) setHostels(h.data);
    if (r.data) setRooms(r.data);
    if (a.data) setOccupiedRoomIds(a.data.map(x => x.room_id).filter(Boolean));
  };

  const roomOccupancy = (roomId: string) => occupiedRoomIds.filter(id => id === roomId).length;
  const hostelOccupancy = (hostelId: string) =>
    rooms.filter(r => r.hostel_id === hostelId).reduce((sum, r) => sum + roomOccupancy(r.id), 0);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("full_name");
    if (data) setStudents(data);
    if (error) toast({ title: "Error loading students", description: error.message, variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchStudents(); fetchSubjects(); fetchBoardingData(); }, [fetchStudents]);

  const filtered = students.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase());
    const matchForm = filterForm === "all" || s.form === filterForm;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchForm && matchStatus;
  });

  const dormitoryOptions = Array.from(
    new Set(
      rooms
        .filter(r => r.hostel_id === selectedHostel)
        .map(r => r.room_type || "dormitory")
    )
  );

  const filteredRooms = rooms.filter(
    r => r.hostel_id === selectedHostel && (selectedDormitoryType === "all" || (r.room_type || "dormitory") === selectedDormitoryType)
  );

  const openAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setPhotoUrl(null);
    setErrors({});
    setSelectedHostel("");
    setSelectedDormitoryType("all");
    setSelectedRoom("");
    setBedNumber("");
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setFormData({
      admission_number: s.admission_number,
      full_name: s.full_name,
      date_of_birth: s.date_of_birth || "",
      form: s.form,
      stream: s.stream || "",
      subject_combination: s.subject_combination || "",
      gender: s.gender || "",
      guardian_name: s.guardian_name || "",
      guardian_phone: s.guardian_phone || "",
      guardian_email: s.guardian_email || "",
      emergency_contact: s.emergency_contact || "",
      medical_conditions: s.medical_conditions || "",
      has_medical_alert: s.has_medical_alert,
      address: s.address || "",
      enrollment_date: s.enrollment_date || "",
      status: s.status,
      sports_activities: s.sports_activities || [],
      boarding_status: s.boarding_status || "day",
    });
    setPhotoUrl(s.profile_photo_url);
    setErrors({});
    // Load existing boarding allocation if boarder
    if (s.boarding_status === "boarder") {
      supabase.from("bed_allocations").select("room_id, bed_number").eq("student_id", s.id).eq("status", "active").maybeSingle().then(({ data: alloc }) => {
        if (alloc) {
          const room = rooms.find(r => r.id === alloc.room_id);
          setSelectedHostel(room ? room.hostel_id : "");
          setSelectedDormitoryType(room?.room_type || "all");
          setSelectedRoom(alloc.room_id);
          setBedNumber(alloc.bed_number || "");
        } else {
          setSelectedHostel("");
          setSelectedDormitoryType("all");
          setSelectedRoom("");
          setBedNumber("");
        }
      });
    } else {
      setSelectedHostel("");
      setSelectedDormitoryType("all");
      setSelectedRoom("");
      setBedNumber("");
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const result = studentFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = { ...result.data, profile_photo_url: photoUrl };

    // Helper to allocate boarding
    const allocateBoarding = async (studentId: string) => {
      if (formData.boarding_status === "boarder" && selectedRoom) {
        // Remove existing active allocation for this student
        await supabase.from("bed_allocations").update({ status: "vacated", allocation_end_date: new Date().toISOString().split("T")[0] }).eq("student_id", studentId).eq("status", "active");
        // Create new allocation
        const { error: allocErr } = await supabase.from("bed_allocations").insert({
          room_id: selectedRoom,
          student_id: studentId,
          bed_number: bedNumber || null,
          status: "active",
        });
        if (allocErr) {
          toast({ title: "Warning", description: "Student saved but hostel allocation failed: " + allocErr.message, variant: "destructive" });
        }
      } else if (formData.boarding_status === "day") {
        // If changed to day, vacate any active allocation
        await supabase.from("bed_allocations").update({ status: "vacated", allocation_end_date: new Date().toISOString().split("T")[0] }).eq("student_id", studentId).eq("status", "active");
      }
    };

    if (editingId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      await allocateBoarding(editingId);
      toast({ title: "Student updated!" });
    } else {
      // Generate a guaranteed-unique admission number using timestamp
      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, "0");
      const nextAdmissionNumber = `MHS${timestamp}${randomSuffix}`;

      const { admission_number, ...rest } = payload;
      const insertPayload = { ...rest, admission_number: nextAdmissionNumber };
      
      
      const { data: newStudent, error } = await supabase
        .from("students")
        .insert(insertPayload)
        .select("id, admission_number")
        .single();
      
      if (error) {
        console.error("STUDENT INSERT ERROR:", JSON.stringify(error));
        toast({ 
          title: "Error", 
          description: `Insert failed: ${error.message} (code: ${error.code})`, 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      // Auto-provision student auth account
      let provisioned = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              action: "provision-student",
              student_id: newStudent.id,
              full_name: result.data.full_name,
              admission_number: newStudent.admission_number,
              guardian_email: result.data.guardian_email,
            }),
          }
        );
        const provData = await res.json();
        if (res.ok) {
          provisioned = true;
          setProvisionResult({
            email: provData.email,
            temp_password: provData.temp_password,
            admission_number: newStudent.admission_number,
            parent: provData.parent || null,
          });
          setProvisionDialogOpen(true);
        } else {
          toast({ title: "Portal account NOT created", description: provData.error || `HTTP ${res.status}`, variant: "destructive" });
        }
      } catch (provErr) {
        console.error("provision-student error:", provErr);
        toast({ title: "Portal account NOT created", description: errorMessage(provErr, "Network error"), variant: "destructive" });
      }

      // Allocate boarding if applicable
      await allocateBoarding(newStudent.id);

      if (!provisioned) {
        toast({ title: "Student added (no portal account)", description: `Student number: ${newStudent?.admission_number}` });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchStudents();
    fetchBoardingData();
  };

  const handleDelete = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (student?.user_id) {
      // Use edge function for full cascade (auth user + student + FKs)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "delete-user", user_id: student.user_id }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        toast({ title: "Student permanently deleted" });
      } catch (err) {
        toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
        return;
      }
    } else {
      // No auth account - use cascade delete RPC
      const { error } = await supabase.rpc("delete_student_cascade", { _student_id: id });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Student permanently deleted" });
    }
    fetchStudents();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
    if (photoRef.current) photoRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const path = `profile-photos/students/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("school-media").upload(path, blob, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("school-media").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast({ title: "Photo uploaded!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const exportCSV = () => {
    const headers = ["Admission #", "Full Name", "Form", "Stream", "Gender", "Guardian Phone", "Status"];
    const rows = filtered.map(s => [s.admission_number, s.full_name, s.form, s.stream || "", s.gender || "", s.guardian_phone || "", s.status]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = <K extends keyof StudentFormData>(key: K, value: StudentFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const provisionExistingStudent = async (s: Student) => {
    if (s.user_id) {
      toast({ title: "Student already has an account", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "provision-student",
            student_id: s.id,
            full_name: s.full_name,
            admission_number: s.admission_number,
            guardian_email: s.guardian_email,
          }),
        }
      );
      const provData = await res.json();
      if (res.ok) {
        setProvisionResult({
          email: provData.email,
          temp_password: provData.temp_password,
          admission_number: s.admission_number,
        });
        setProvisionDialogOpen(true);
        fetchStudents();
      } else {
        toast({ title: "Account creation failed", description: provData.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Account creation failed", description: errorMessage(err), variant: "destructive" });
    }
    setSaving(false);
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-green-100 text-green-800";
    if (s === "graduated") return "bg-blue-100 text-blue-800";
    return "bg-orange-100 text-orange-800";
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="students">
        <TabsList className="mb-4">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="term-registration"><UserCheck className="mr-1 h-4 w-4" /> Term Registration</TabsTrigger>
        </TabsList>
        <TabsContent value="term-registration">
          <TermRegistration />
        </TabsContent>
        <TabsContent value="students">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">Student Management</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
          <Button onClick={openAdd} className="bg-secondary text-secondary-foreground hover:bg-secondary/90"><Plus className="mr-1 h-4 w-4" /> Add Student</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or admission #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterForm} onValueChange={setFilterForm}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Form" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {FORM_LEVELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Form/Stream</TableHead>
                <TableHead>Guardian Phone</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No students found. Click "Add Student" to get started.</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.profile_photo_url ? (
                      <img src={s.profile_photo_url} alt={s.full_name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon-light">
                        <User className="h-4 w-4 text-secondary" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.admission_number}</TableCell>
                  <TableCell className="font-medium">
                    {s.full_name}
                    {s.has_medical_alert && <AlertTriangle className="ml-1 inline h-4 w-4 text-destructive" />}
                  </TableCell>
                  <TableCell className="text-sm">{s.email || "—"}</TableCell>
                  <TableCell>{s.form}{s.stream ? ` / ${s.stream}` : ""}</TableCell>
                  <TableCell>{s.guardian_phone || "—"}</TableCell>
                  <TableCell>
                    {s.user_id ? (
                      <Badge className="bg-green-100 text-green-800">Portal Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">No Account</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!s.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Provision portal account"
                          onClick={() => provisionExistingStudent(s)}
                        >
                          <KeyRound className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedStudent(s); setProfileOpen(true); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                             <AlertDialogTitle>Permanently Delete Student?</AlertDialogTitle>
                             <AlertDialogDescription>This will permanently delete {s.full_name} and all associated records (grades, attendance, invoices, etc.). This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingId ? "Edit Student" : "Add New Student"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Photo */}
            <div className="sm:col-span-2 flex items-center gap-4">
              {photoUrl ? (
                <img src={photoUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-light"><User className="h-8 w-8 text-secondary" /></div>
              )}
              <div className="flex gap-2">
                <input type="file" accept="image/*" ref={photoRef} onChange={handlePhotoSelect} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowWebcam(true)} disabled={uploading}>
                  <Camera className="mr-1 h-4 w-4" /> Take Photo
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Student Number {editingId ? "" : "(Auto-generated)"}</Label>
              {editingId ? (
                <Input value={formData.admission_number} readOnly className="bg-muted" />
              ) : (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted">
                  Will be auto-generated as <strong>MHS#####</strong> on save
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={formData.full_name} onChange={e => updateField("full_name", e.target.value)} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" value={formData.date_of_birth || ""} onChange={e => updateField("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={formData.gender || ""} onValueChange={v => updateField("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Form *</Label>
              <Select value={formData.form} onValueChange={v => updateField("form", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORM_LEVELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Stream</Label>
              <Select value={formData.stream || ""} onValueChange={v => updateField("stream", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{streamOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Subjects</Label>
              {dbSubjects.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                  {dbSubjects.map(subj => {
                    const selected = (formData.subject_combination || "").split(", ").filter(Boolean);
                    const isChecked = selected.includes(subj.name);
                    return (
                      <label key={subj.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-1">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const current = (formData.subject_combination || "").split(", ").filter(Boolean);
                            const updated = checked
                              ? [...current, subj.name]
                              : current.filter(s => s !== subj.name);
                            updateField("subject_combination", updated.join(", "));
                          }}
                        />
                        <span className="text-sm">{subj.name}</span>
                        {subj.department && <span className="text-[10px] text-muted-foreground">({subj.department})</span>}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No subjects loaded. Add subjects in Academic Management first.</p>
              )}
              {formData.subject_combination && (
                <p className="text-xs text-primary font-medium">{formData.subject_combination.split(", ").filter(Boolean).length} subject(s) selected</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Guardian Name</Label>
              <Input value={formData.guardian_name || ""} onChange={e => updateField("guardian_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Guardian Phone</Label>
              <Input value={formData.guardian_phone || ""} onChange={e => updateField("guardian_phone", e.target.value)} placeholder="07XXXXXXXX" />
              {errors.guardian_phone && <p className="text-xs text-destructive">{errors.guardian_phone}</p>}
            </div>
            <div className="space-y-1">
              <Label>Guardian Email</Label>
              <Input value={formData.guardian_email || ""} onChange={e => updateField("guardian_email", e.target.value)} type="email" />
            </div>
            <div className="space-y-1">
              <Label>Emergency Contact</Label>
              <Input value={formData.emergency_contact || ""} onChange={e => updateField("emergency_contact", e.target.value)} placeholder="07XXXXXXXX" />
              {errors.emergency_contact && <p className="text-xs text-destructive">{errors.emergency_contact}</p>}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={formData.address || ""} onChange={e => updateField("address", e.target.value)} rows={2} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Medical Conditions</Label>
              <Textarea value={formData.medical_conditions || ""} onChange={e => updateField("medical_conditions", e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox checked={formData.has_medical_alert} onCheckedChange={v => updateField("has_medical_alert", !!v)} id="medical-alert" />
              <Label htmlFor="medical-alert" className="text-sm text-destructive font-medium">Has Medical Alert</Label>
            </div>

            {/* Sports Activities */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Sports & Extracurricular Activities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border p-3">
                {sportsOptions.map(sport => (
                  <label key={sport} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-1">
                    <Checkbox
                      checked={(formData.sports_activities || []).includes(sport)}
                      onCheckedChange={(checked) => {
                        const current = formData.sports_activities || [];
                        const updated = checked
                          ? [...current, sport]
                          : current.filter(s => s !== sport);
                        updateField("sports_activities", updated);
                      }}
                    />
                    <span className="text-sm">{sport}</span>
                  </label>
                ))}
              </div>
              {(formData.sports_activities || []).length > 0 && (
                <p className="text-xs text-primary font-medium">{(formData.sports_activities || []).length} sport(s) selected</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Boarding Status *</Label>
              <Select value={formData.boarding_status || "day"} onValueChange={v => { updateField("boarding_status", v); if (v === "day") { setSelectedHostel(""); setSelectedDormitoryType("all"); setSelectedRoom(""); setBedNumber(""); } }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Scholar</SelectItem>
                  <SelectItem value="boarder">Boarder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.boarding_status === "boarder" && (
              <div className="col-span-full rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Users className="h-4 w-4" /> Hostel Allocation
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Hostel</Label>
                    <Select value={selectedHostel} onValueChange={v => { setSelectedHostel(v); setSelectedDormitoryType("all"); setSelectedRoom(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select hostel..." /></SelectTrigger>
                      <SelectContent>
                        {hostels.map(h => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name} ({hostelOccupancy(h.id)}/{h.capacity ?? 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dormitory</Label>
                    <Select value={selectedDormitoryType} onValueChange={v => { setSelectedDormitoryType(v); setSelectedRoom(""); }} disabled={!selectedHostel}>
                      <SelectTrigger><SelectValue placeholder="Select dormitory..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dormitories</SelectItem>
                        {dormitoryOptions.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Room</Label>
                    <Select value={selectedRoom} onValueChange={setSelectedRoom} disabled={!selectedHostel}>
                      <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                      <SelectContent>
                        {filteredRooms.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            Room {r.room_number} ({roomOccupancy(r.id)}/{r.capacity ?? 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bed Number (optional)</Label>
                    <Input value={bedNumber} onChange={e => setBedNumber(e.target.value)} placeholder="e.g. B3" />
                  </div>
                </div>
                {!selectedHostel && (
                  <p className="text-xs text-muted-foreground">Select a hostel and room to allocate this student. You can also do this later from Boarding Management.</p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>Enrollment Date</Label>
              <Input type="date" value={formData.enrollment_date || ""} onChange={e => updateField("enrollment_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {saving ? "Saving..." : editingId ? "Update Student" : "Add Student"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Cropper */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          open={cropOpen}
          onClose={() => { setCropOpen(false); setCropSrc(null); }}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          cropShape="round"
          title="Crop Student Photo"
        />
      )}

      {/* Student Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-3">
                  {selectedStudent.profile_photo_url ? (
                    <img src={selectedStudent.profile_photo_url} alt={selectedStudent.full_name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-light"><User className="h-6 w-6 text-secondary" /></div>
                  )}
                  {selectedStudent.full_name}
                  {selectedStudent.has_medical_alert && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Medical Alert</Badge>}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="personal">
                <TabsList className="w-full flex-wrap">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="academics">Academics</TabsTrigger>
                  <TabsTrigger value="fees">Fees</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="boarding">Boarding</TabsTrigger>
                </TabsList>
                <TabsContent value="personal" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Admission #", selectedStudent.admission_number],
                      ["Email", selectedStudent.email],
                      ["Form", selectedStudent.form],
                      ["Stream", selectedStudent.stream],
                      ["Gender", selectedStudent.gender],
                      ["Date of Birth", selectedStudent.date_of_birth],
                      ["Subject Combination", selectedStudent.subject_combination],
                      ["Guardian", selectedStudent.guardian_name],
                      ["Guardian Phone", selectedStudent.guardian_phone],
                      ["Guardian Email", selectedStudent.guardian_email],
                      ["Emergency Contact", selectedStudent.emergency_contact],
                      ["Address", selectedStudent.address],
                      ["Enrollment Date", selectedStudent.enrollment_date],
                      ["Status", selectedStudent.status],
                      ["Sports/Activities", (selectedStudent.sports_activities || []).join(", ") || "None"],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  {selectedStudent.medical_conditions && (
                    <div className={`rounded-lg p-3 ${selectedStudent.has_medical_alert ? "bg-destructive/10 border border-destructive/30" : "bg-muted"}`}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Medical Conditions</p>
                      <p className={`text-sm ${selectedStudent.has_medical_alert ? "text-destructive font-medium" : ""}`}>{selectedStudent.medical_conditions}</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="academics">
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-lg font-medium">Academic records</p>
                    <p className="text-sm">Grades and subject enrollment will appear here.</p>
                  </div>
                </TabsContent>
                <TabsContent value="fees">
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-lg font-medium">Fee Records</p>
                    <p className="text-sm">Invoice summary and balances (USD/ZiG) will appear here.</p>
                  </div>
                </TabsContent>
                <TabsContent value="attendance">
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-lg font-medium">Attendance</p>
                    <p className="text-sm">Attendance charts will appear here.</p>
                  </div>
                </TabsContent>
                <TabsContent value="boarding">
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-lg font-medium">Boarding</p>
                    <p className="text-sm">Room allocation details will appear here.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      <WebcamCapture
        open={showWebcam}
        onClose={() => setShowWebcam(false)}
        onCapture={(blob) => { setCropSrc(URL.createObjectURL(blob)); setCropOpen(true); }}
        title="Take Student Photo"
      />
      {/* Student Credentials Dialog */}
      <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Student Account Created</DialogTitle>
          </DialogHeader>
          {provisionResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A portal account has been created for this student. Please share the following credentials securely. The student will be required to change their password on first login.
              </p>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Admission Number</p>
                  <p className="font-mono font-bold">{provisionResult.admission_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Login Email</p>
                  <p className="font-mono font-bold">{provisionResult.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temporary Password</p>
                  <p className="font-mono font-bold text-primary">{provisionResult.temp_password}</p>
                </div>
              </div>
              {provisionResult.parent && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-semibold">Parent Portal Account</p>
                  <div>
                    <p className="text-xs text-muted-foreground">Parent Login Email</p>
                    <p className="font-mono font-bold">{provisionResult.parent.email}</p>
                  </div>
                  {provisionResult.parent.temp_password ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Temporary Password</p>
                      <p className="font-mono font-bold text-primary">{provisionResult.parent.temp_password}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {provisionResult.parent.existed
                        ? "An existing parent account was linked to this student. Use the parent's existing password."
                        : "No temporary password generated."}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const text = `Student Portal Credentials\nAdmission: ${provisionResult.admission_number}\nEmail: ${provisionResult.email}\nTemp Password: ${provisionResult.temp_password}\n\nPlease change your password on first login.`;
                    navigator.clipboard.writeText(text);
                    toast({ title: "Credentials copied to clipboard" });
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy All
                </Button>
                <Button onClick={() => setProvisionDialogOpen(false)} className="flex-1">Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
