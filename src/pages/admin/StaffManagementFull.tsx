import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emptyToNull } from "@/lib/utils";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Upload,
  Download,
  User,
  Calendar,
  Camera,
  Copy,
  KeyRound,
} from "lucide-react";
import { staffFormSchema, type StaffFormData } from "@/lib/validators";
import ImageCropper from "@/components/ImageCropper";
import WebcamCapture from "@/components/WebcamCapture";
import { errorMessage } from "@/lib/errors";
import { STAFF_COLUMNS, saveStaffPrivate, splitStaffPrivate, withStaffPrivate } from "@/lib/staff";
import { useAuth } from "@/contexts/AuthContext";

const roleOptions = ["principal", "deputy_principal", "hod", "admin", "bursar", "teacher", "senior_teacher", "housemaster", "counsellor", "librarian", "it_administrator", "groundskeeper", "matron", "secretary", "sports_director", "lab_technician", "school_administrator", "admin_clerk", "finance_clerk"];
const departmentOptions = [
  "Mathematics",
  "Sciences",
  "Languages",
  "Humanities",
  "Technical",
  "Arts",
  "Sports",
  "Administration",
  "IT",
];
const categoryOptions = ["leadership", "teaching", "admin", "general"];
const statusOptions = ["active", "on-leave", "terminated"];
const subjectsList = [
  "Mathematics",
  "English",
  "Shona",
  "Ndebele",
  "History",
  "Geography",
  "Physics",
  "Chemistry",
  "Biology",
  "Accounts",
  "Commerce",
  "Computer Science",
  "Agriculture",
  "Technical Graphics",
  "Food & Nutrition",
  "Fashion & Fabrics",
  "Music",
  "Art",
  "Physical Education",
];

type StaffMember = {
  id: string;
  full_name: string;
  staff_number: string | null;
  role: string | null;
  department: string | null;
  category: string;
  title: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  address: string | null;
  emergency_contact: string | null;
  employment_date: string | null;
  qualifications: string | null;
  nssa_number: string | null;
  paye_number: string | null;
  bank_details: string | null;
  national_id: string | null;
  status: string | null;
  subjects_taught: string[] | null;
  deleted_at: string | null;
  user_id: string | null;
  created_at: string;
};

type LeaveRequest = {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const emptyForm: StaffFormData = {
  staff_number: "",
  full_name: "",
  role: "teacher",
  department: "",
  subjects_taught: [],
  phone: "",
  email: "",
  address: "",
  emergency_contact: "",
  employment_date: "",
  qualifications: "",
  nssa_number: "",
  paye_number: "",
  bank_details: "",
  national_id: "",
  status: "active",
  category: "teaching",
  title: "",
  bio: "",
};

// Helper functions for portal account provisioning
const STAFF_EMAIL_DOMAIN = "mbsmavingtech.ac.zw";

function generateTempPassword() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

function slugifyNamePart(part: string) {
  return part
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildStaffEmail(fullName: string, existing: string[] = []): string {
  const cleaned = (fullName || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).map(slugifyNamePart).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const base = last ? `${first}.${last}` : first;
  const taken = new Set(existing.map((e) => e.toLowerCase()));
  let candidate = `${base}@${STAFF_EMAIL_DOMAIN}`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${n}@${STAFF_EMAIL_DOMAIN}`;
    n++;
  }
  return candidate;
}

function getPortalRole(staffRole: string): string {
  switch (staffRole) {
    case "admin":
      return "admin";
    case "principal":
    case "deputy_principal":
      return "principal";
    case "hod":
      return "hod";
    case "finance_clerk":
      return "finance_clerk";
    case "bursar":
      return "bursar";
    case "teacher":
    default:
      return "teacher";
  }
}

const HR_ADMIN_ROLES = ["admin", "principal", "deputy_principal", "admin_supervisor", "supervisor"];

export default function StaffManagementFull() {
  const { toast } = useToast();
  const { role } = useAuth();
  // Only administrators may see or change staff HR details (the database enforces this too).
  const canManageHr = HR_ADMIN_ROLES.includes(role ?? "");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [classTeacherMap, setClassTeacherMap] = useState<Record<string, string[]>>({});
  const [teachingClassesMap, setTeachingClassesMap] = useState<
    Record<string, { className: string; subjectName: string }[]>
  >({});
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });

  // Provision result dialog
  const [provisionResult, setProvisionResult] = useState<{
    email: string;
    temp_password: string;
    portal_role: string;
  } | null>(null);
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);

  // Photo
  const photoRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("staff").select(STAFF_COLUMNS).order("full_name");
    if (data) setStaff((await withStaffPrivate(data)) as unknown as StaffMember[]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchStaff();
    fetchClassAssignments();
  }, [fetchStaff]);

  const fetchClassAssignments = async () => {
    // Fetch class teacher assignments
    const { data: classes } = await supabase.from("classes").select("id, name, class_teacher_id");
    if (classes) {
      const ctMap: Record<string, string[]> = {};
      classes.forEach((c) => {
        if (c.class_teacher_id) {
          if (!ctMap[c.class_teacher_id]) ctMap[c.class_teacher_id] = [];
          ctMap[c.class_teacher_id].push(c.name);
        }
      });
      setClassTeacherMap(ctMap);
    }

    // Fetch teaching assignments (class_subjects)
    const { data: cs } = await supabase.from("class_subjects").select("teacher_id, classes(name), subjects(name)");
    if (cs) {
      const tcMap: Record<string, { className: string; subjectName: string }[]> = {};
      cs.forEach((row) => {
        if (row.teacher_id) {
          if (!tcMap[row.teacher_id]) tcMap[row.teacher_id] = [];
          tcMap[row.teacher_id].push({
            className: row.classes?.name || "-",
            subjectName: row.subjects?.name || "-",
          });
        }
      });
      setTeachingClassesMap(tcMap);
    }
  };

  const fetchLeave = async (staffId: string) => {
    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false });
    if (data) setLeaveRequests(data as LeaveRequest[]);
  };

  const filtered = staff.filter((s) => {
    const matchSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.staff_number || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || s.role === filterRole;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const openAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setPhotoUrl(null);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setFormData({
      staff_number: s.staff_number || "",
      full_name: s.full_name,
      role: s.role || "teacher",
      department: s.department || "",
      subjects_taught: s.subjects_taught || [],
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      emergency_contact: s.emergency_contact || "",
      employment_date: s.employment_date || "",
      qualifications: s.qualifications || "",
      nssa_number: s.nssa_number || "",
      paye_number: s.paye_number || "",
      bank_details: s.bank_details || "",
      national_id: s.national_id || "",
      status: s.status || "active",
      category: s.category,
      title: s.title || "",
      bio: s.bio || "",
    });
    setPhotoUrl(s.photo_url);
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const result = staffFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const parsed = { ...result.data, photo_url: photoUrl };
    // Convert empty strings to null for date and optional fields to avoid "invalid input syntax for type date"
    const payload = emptyToNull(parsed);

    if (editingId) {
      // HR details (ID, NSSA/PAYE, bank, address, emergency contact) live in staff_private.
      const { staff: staffFields, hr } = splitStaffPrivate(payload);
      const { error } = await supabase.from("staff").update(staffFields).eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      if (canManageHr) {
        try {
          await saveStaffPrivate(editingId, hr);
        } catch (e) {
          toast({ title: "HR details not saved", description: errorMessage(e), variant: "destructive" });
          setSaving(false);
          return;
        }
      }
      toast({ title: "Staff member updated!" });
    } else {
      // Ensure a portal email exists - auto-generate from full name if the
      // admin didn't provide one.
      if (!payload.email) {
        payload.email = buildStaffEmail(
          payload.full_name || "",
          staff.map((s) => s.email || "").filter(Boolean),
        );
      }
      // Let the edge function handle both auth user creation AND staff record insertion
      // to avoid duplicate staff records
      try {
        const tempPassword = generateTempPassword();
        const portalRole = getPortalRole(payload.role || "teacher");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "create-user",
            full_name: payload.full_name,
            email: payload.email,
            password: tempPassword,
            portal_role: portalRole,
            staff_role: payload.role,
            department: payload.department,
            phone: payload.phone,
            photo_url: photoUrl,
            title: payload.title,
            bio: payload.bio,
            address: payload.address,
            emergency_contact: payload.emergency_contact,
            qualifications: payload.qualifications,
            national_id: payload.national_id,
            employment_date: payload.employment_date,
            subjects_taught: payload.subjects_taught,
          }),
        });
        const provData = await res.json();
        if (res.ok) {
          setProvisionResult({
            email: payload.email,
            temp_password: tempPassword,
            portal_role: portalRole,
          });
          setProvisionDialogOpen(true);
          toast({ title: "Staff member added!", description: `Staff number: ${provData.staff_number || "auto-assigned"}` });
        } else {
          toast({
            title: "Error creating staff member",
            description: provData.error,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      } catch (provErr) {
        toast({
          title: "Error creating staff member",
          description: errorMessage(provErr),
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchStaff();
  };

  const handleDelete = async (id: string) => {
    // Find the staff member to check if they have a user_id (auth account)
    const member = staff.find(s => s.id === id);
    if (member?.user_id) {
      // Use edge function for full cascade (auth user + staff + FKs)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "delete-user", user_id: member.user_id }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        toast({ title: "Staff member permanently deleted" });
      } catch (err) {
        toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
        return;
      }
    } else {
      // No auth account - use cascade delete RPC
      const { error } = await supabase.rpc("delete_staff_cascade", { _staff_id: id });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Staff member permanently deleted" });
    }
    fetchStaff();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (photoRef.current) photoRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const path = `profile-photos/staff/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("school-media")
        .upload(path, blob, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("school-media").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast({ title: "Photo uploaded!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleLeaveSubmit = async () => {
    if (!selectedStaff || !leaveForm.start_date || !leaveForm.end_date) return;
    const { error } = await supabase.from("leave_requests").insert({
      staff_id: selectedStaff.id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Leave request submitted!" });
    setLeaveDialogOpen(false);
    setLeaveForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
    fetchLeave(selectedStaff.id);
  };

  const handleLeaveAction = async (id: string, action: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status: action }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Leave ${action}` });
      if (selectedStaff) fetchLeave(selectedStaff.id);
    }
  };

  const exportCSV = () => {
    const headers = ["Staff #", "Full Name", "Role", "Department", "Phone", "Status"];
    const rows = filtered.map((s) => [
      s.staff_number || "",
      s.full_name,
      s.role || "",
      s.department || "",
      s.phone || "",
      s.status || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = <K extends keyof StaffFormData>(key: K, value: StaffFormData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-generate portal email from full name for new staff when
      // the admin has not manually entered an email yet.
      if (
        key === "full_name" &&
        !editingId &&
        (!prev.email || prev.email.endsWith(`@${STAFF_EMAIL_DOMAIN}`))
      ) {
        next.email = buildStaffEmail(
          next.full_name || "",
          staff.map((s) => s.email || "").filter(Boolean),
        );
      }
      return next;
    });
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  };

  const toggleSubject = (subject: string) => {
    const current = formData.subjects_taught || [];
    const updated = current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject];
    updateField("subjects_taught", updated);
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-green-100 text-green-800";
    if (s === "on-leave") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">Staff Management</h2>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={openAdd} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="mr-1 h-4 w-4" /> Add Staff
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or staff #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
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
                <TableHead>Staff #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Class Teacher</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No staff found. Click "Add Staff" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.photo_url ? (
                        <img src={s.photo_url} alt={s.full_name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon-light">
                          <User className="h-4 w-4 text-secondary" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.staff_number || "-"}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="capitalize">{s.role || "-"}</TableCell>
                    <TableCell>
                      {classTeacherMap[s.id] ? (
                        <div className="flex flex-wrap gap-1">
                          {classTeacherMap[s.id].map((cn) => (
                            <Badge key={cn} className="bg-purple-100 text-purple-800 text-xs">
                              {cn}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{s.department || "-"}</TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(s.status || "active")}>{s.status || "active"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedStaff(s);
                            fetchLeave(s.id);
                            setProfileOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently Delete Staff Member?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete {s.full_name} and all associated records. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(s.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingId ? "Edit Staff Member" : "Add New Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="personal">
            <TabsList className="w-full">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4">
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-light">
                    <User className="h-8 w-8 text-secondary" />
                  </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Staff Number {editingId ? "" : "(Auto-generated)"}</Label>
                  <Input
                    value={formData.staff_number}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    placeholder={editingId ? "" : "Will be assigned automatically"}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Full Name *</Label>
                  <Input value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} />
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    value={formData.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="e.g. Mr, Mrs, Dr"
                  />
                </div>
                {canManageHr && (
                <div className="space-y-1">
                  <Label>National ID</Label>
                  <Input
                    value={formData.national_id || ""}
                    onChange={(e) => updateField("national_id", e.target.value)}
                    placeholder="e.g. 63-123456-A-00"
                    maxLength={13}
                    inputMode="numeric"
                  />
                  {errors.national_id && <p className="text-xs text-destructive">{errors.national_id}</p>}
                </div>
                )}
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="e.g. 0772123456 or +263772123456"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                {editingId && (
                  <div className="space-y-1">
                    <Label>Portal Email</Label>
                    <Input value={formData.email || ""} type="email" readOnly disabled />
                    <p className="text-xs text-muted-foreground">
                      Auto-generated by the system. Cannot be changed here.
                    </p>
                  </div>
                )}
                {canManageHr && (
                <div className="space-y-1">
                  <Label>Emergency Contact</Label>
                  <Input
                    value={formData.emergency_contact || ""}
                    onChange={(e) => updateField("emergency_contact", e.target.value)}
                    placeholder="e.g. 0772123456 or +263772123456"
                  />
                  {errors.emergency_contact && <p className="text-xs text-destructive">{errors.emergency_contact}</p>}
                </div>
                )}
                {canManageHr && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={formData.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                    rows={2}
                    placeholder="Street, suburb, city (e.g. 12 Main Rd, Avondale, Harare)"
                  />
                </div>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <Label>Bio</Label>
                  <Textarea value={formData.bio || ""} onChange={(e) => updateField("bio", e.target.value)} rows={2} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="employment" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(v) => updateField("role", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => updateField("category", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Select value={formData.department || ""} onValueChange={(v) => updateField("department", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Employment Date</Label>
                  <Input
                    type="date"
                    value={formData.employment_date || ""}
                    onChange={(e) => updateField("employment_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Qualifications</Label>
                  <Textarea
                    value={formData.qualifications || ""}
                    onChange={(e) => updateField("qualifications", e.target.value)}
                    rows={2}
                    placeholder="e.g. B.Ed, MSc Mathematics"
                  />
                </div>
                {canManageHr && (
                <div className="space-y-1">
                  <Label>NSSA Number</Label>
                  <Input
                    value={formData.nssa_number || ""}
                    onChange={(e) => updateField("nssa_number", e.target.value)}
                  />
                </div>
                )}
                {canManageHr && (
                <div className="space-y-1">
                  <Label>ZIMRA PAYE / TIN Number</Label>
                  <Input
                    value={formData.paye_number || ""}
                    onChange={(e) => updateField("paye_number", e.target.value)}
                  />
                </div>
                )}
                {canManageHr && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Bank Details</Label>
                  <Textarea
                    value={formData.bank_details || ""}
                    onChange={(e) => updateField("bank_details", e.target.value)}
                    rows={2}
                    placeholder="e.g. CBZ Bank, Acc 01123456780012, Branch: Harare Main"
                  />
                </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="subjects" className="space-y-4">
              <p className="text-sm text-muted-foreground">Select subjects taught by this staff member:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {subjectsList.map((subject) => (
                  <label
                    key={subject}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors ${(formData.subjects_taught || []).includes(subject) ? "border-secondary bg-maroon-light" : "border-border hover:bg-muted"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={(formData.subjects_taught || []).includes(subject)}
                      onChange={() => toggleSubject(subject)}
                    />
                    <span>{subject}</span>
                  </label>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {saving ? "Saving..." : editingId ? "Update Staff" : "Add Staff"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Cropper */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          open={cropOpen}
          onClose={() => {
            setCropOpen(false);
            setCropSrc(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          cropShape="round"
          title="Crop Staff Photo"
        />
      )}

      {/* Staff Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedStaff && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-3">
                  {selectedStaff.photo_url ? (
                    <img
                      src={selectedStaff.photo_url}
                      alt={selectedStaff.full_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-light">
                      <User className="h-6 w-6 text-secondary" />
                    </div>
                  )}
                  {selectedStaff.title ? `${selectedStaff.title} ` : ""}
                  {selectedStaff.full_name}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="personal">
                <TabsList className="w-full flex-wrap">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                  <TabsTrigger value="classes">Classes & Assignments</TabsTrigger>
                  <TabsTrigger value="subjects">Subjects</TabsTrigger>
                  <TabsTrigger value="leave">Leave</TabsTrigger>
                </TabsList>
                <TabsContent value="personal" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Staff #", selectedStaff.staff_number],
                      ["Role", selectedStaff.role],
                      ["Department", selectedStaff.department],
                      ["Category", selectedStaff.category],
                      ["Phone", selectedStaff.phone],
                      ["Email", selectedStaff.email],
                      ["Emergency Contact", selectedStaff.emergency_contact],
                      ["National ID", selectedStaff.national_id],
                      ["Address", selectedStaff.address],
                      ["Status", selectedStaff.status],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium capitalize">{(value as string) || "-"}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="employment" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Employment Date", selectedStaff.employment_date],
                      ["Qualifications", selectedStaff.qualifications],
                      ["NSSA Number", selectedStaff.nssa_number],
                      ["ZIMRA PAYE / TIN Number", selectedStaff.paye_number],
                      ["Bank Details", selectedStaff.bank_details],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{(value as string) || "-"}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="classes" className="space-y-4">
                  {/* Class Teacher Section */}
                  <div>
                    <h4 className="font-heading text-sm font-semibold mb-2">Class Teacher For</h4>
                    {classTeacherMap[selectedStaff.id] && classTeacherMap[selectedStaff.id].length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {classTeacherMap[selectedStaff.id].map((cn) => (
                          <Badge key={cn} className="bg-purple-100 text-purple-800">
                            {cn}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assigned as class teacher for any class.</p>
                    )}
                  </div>
                  {/* Teaching Assignments */}
                  <div>
                    <h4 className="font-heading text-sm font-semibold mb-2">Teaching Assignments</h4>
                    {teachingClassesMap[selectedStaff.id] && teachingClassesMap[selectedStaff.id].length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead>Subject</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teachingClassesMap[selectedStaff.id].map((a, i) => (
                            <TableRow key={i}>
                              <TableCell>{a.className}</TableCell>
                              <TableCell>{a.subjectName}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No teaching assignments found. Assign via Academic Management → Class Subjects.
                      </p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="subjects">
                  {selectedStaff.subjects_taught && selectedStaff.subjects_taught.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedStaff.subjects_taught.map((s) => (
                        <Badge key={s} className="bg-maroon-light text-foreground">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-muted-foreground">No subjects assigned.</p>
                  )}
                </TabsContent>
                <TabsContent value="leave" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-heading text-lg font-semibold">Leave History</h3>
                    <Button
                      size="sm"
                      onClick={() => setLeaveDialogOpen(true)}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    >
                      <Calendar className="mr-1 h-4 w-4" /> Request Leave
                    </Button>
                  </div>
                  {leaveRequests.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">No leave requests found.</p>
                  ) : (
                    <div className="space-y-2">
                      {leaveRequests.map((l) => (
                        <Card key={l.id}>
                          <CardContent className="flex items-center justify-between p-3">
                            <div>
                              <p className="font-medium capitalize">{l.leave_type} Leave</p>
                              <p className="text-sm text-muted-foreground">
                                {l.start_date} to {l.end_date}
                              </p>
                              {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  l.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : l.status === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                }
                              >
                                {l.status}
                              </Badge>
                              {l.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLeaveAction(l.id, "approved")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLeaveAction(l.id, "rejected")}
                                    className="text-destructive"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Request Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select
                value={leaveForm.leave_type}
                onValueChange={(v) => setLeaveForm((p) => ({ ...p, leave_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["annual", "sick", "maternity", "paternity", "compassionate", "study"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                rows={2}
              />
            </div>
            <Button
              onClick={handleLeaveSubmit}
              disabled={!leaveForm.start_date || !leaveForm.end_date}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WebcamCapture
        open={showWebcam}
        onClose={() => setShowWebcam(false)}
        onCapture={(blob) => {
          setCropSrc(URL.createObjectURL(blob));
          setCropOpen(true);
        }}
        title="Take Staff Photo"
      />
      {/* Staff Account Credentials Dialog */}
      <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Staff Portal Account Created
            </DialogTitle>
          </DialogHeader>
          {provisionResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A portal account has been created for this staff member. Please share these credentials securely. They
                will be prompted to change their password on first login.
              </p>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm font-semibold">{provisionResult.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temporary Password</p>
                  <p className="font-mono text-sm font-semibold">{provisionResult.temp_password}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Portal Role</p>
                  <Badge className="capitalize">{provisionResult.portal_role}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Email: ${provisionResult.email}\nPassword: ${provisionResult.temp_password}`,
                    );
                    toast({ title: "Credentials copied to clipboard" });
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy Credentials
                </Button>
                <Button size="sm" onClick={() => setProvisionDialogOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
