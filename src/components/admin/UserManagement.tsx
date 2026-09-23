import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UserPlus,
  Users,
  Search,
  Shield,
  Trash2,
  KeyRound,
  Pencil,
  FileSpreadsheet,
  Loader2,
  Camera,
  Upload,
  X,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BulkUserImport from "./BulkUserImport";
import ImageCropper from "@/components/ImageCropper";
import WebcamCapture from "@/components/WebcamCapture";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const portalRoles = [
  { value: "admin", label: "System Administrator" },
  { value: "admin_supervisor", label: "Admin Supervisor" },
  { value: "principal", label: "Principal" },
  { value: "deputy_principal", label: "Deputy Principal" },
  { value: "hod", label: "Head of Department" },
  { value: "finance", label: "Finance Admin Clerk" },
  { value: "finance_clerk", label: "Finance Clerk" },
  { value: "bursar", label: "Bursar" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

const staffRoles = [
  { value: "principal", label: "Principal" },
  { value: "deputy_principal", label: "Deputy Principal" },
  { value: "hod", label: "Head of Department (HOD)" },
  { value: "teacher", label: "Teacher" },
  { value: "senior_teacher", label: "Senior Teacher" },
  { value: "school_administrator", label: "School Administrator" },
  { value: "admin_clerk", label: "Admin Clerk" },
  { value: "finance_clerk", label: "Finance Clerk" },
  { value: "bursar", label: "Bursar" },
  { value: "librarian", label: "Librarian" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "sports_director", label: "Sports Director" },
  { value: "secretary", label: "Secretary" },
  { value: "groundsman", label: "Groundsman" },
  { value: "matron", label: "Matron" },
  { value: "it_administrator", label: "IT Administrator" },
];

// Map portal roles to default staff positions
const portalToStaffDefault: Record<string, string> = {
  principal: "principal",
  deputy_principal: "deputy_principal",
  hod: "hod",
  finance: "bursar",
  finance_clerk: "finance_clerk",
  bursar: "bursar",
  admin: "secretary",
  admin_supervisor: "secretary",
  teacher: "teacher",
  registration: "secretary",
};

const staffRoleLabels: Record<string, string> = Object.fromEntries(staffRoles.map((r) => [r.value, r.label]));

const departmentOptions = [
  "Mathematics",
  "Sciences",
  "Languages",
  "Humanities",
  "Technical",
  "Arts",
  "Sports",
  "Administration",
];
const gradeOptions = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
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

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  portal_role: string;
  staff_role?: string;
  department?: string;
  created_at: string;
}

interface ClassOption {
  id: string;
  name: string;
  level: string | null;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const createFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  // Photo state for create
  const [createPhotoBlob, setCreatePhotoBlob] = useState<Blob | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);
  const [showCreateCropper, setShowCreateCropper] = useState(false);
  const [createCropSrc, setCreateCropSrc] = useState("");
  const [showCreateWebcam, setShowCreateWebcam] = useState(false);

  // Photo state for edit
  const [editPhotoBlob, setEditPhotoBlob] = useState<Blob | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [showEditCropper, setShowEditCropper] = useState(false);
  const [editCropSrc, setEditCropSrc] = useState("");
  const [showEditWebcam, setShowEditWebcam] = useState(false);

  // Create user form
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    portal_role: "teacher" as string,
    staff_role: "teacher" as string,
    department: "",
    phone: "",
    grade: "",
    class_name: "",
    assigned_class_id: "",
    subjects_taught: [] as string[],
    teaching_class_ids: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: "create" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (mode === "create") {
      setCreateCropSrc(url);
      setShowCreateCropper(true);
    } else {
      setEditCropSrc(url);
      setShowEditCropper(true);
    }
    e.target.value = "";
  };

  const handleWebcamCapture = (blob: Blob, mode: "create" | "edit") => {
    const url = URL.createObjectURL(blob);
    if (mode === "create") {
      setCreateCropSrc(url);
      setShowCreateCropper(true);
    } else {
      setEditCropSrc(url);
      setShowEditCropper(true);
    }
  };

  const uploadPhoto = async (blob: Blob, userId: string, role: string): Promise<string | null> => {
    const folder = role === "student" ? "profile-photos/students" : "profile-photos/staff";
    const ext = "jpg";
    const path = `${folder}/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("school-media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error("Photo upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("school-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  useEffect(() => {
    fetchUsers();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data } = await supabase.from("classes").select("id, name, level").order("name");
      if (data) setClasses(data);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log("-- fetchUsers started --");

      // 1. Fetch staff users via Edge Function
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Session:", session);
      if (!session?.access_token) {
        toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const token = session.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "list-users" }),
      });
      const data = await res.json();
      console.log("Edge Function response:", data);
      if (data.error) throw new Error(data.error);
      const staffUsersFromEdge: ManagedUser[] = data.users || [];
      console.log("Staff users from Edge count:", staffUsersFromEdge.length);
      console.log("Staff users from Edge:", staffUsersFromEdge);

      // 2. Fetch staff users directly from staff table (as backup)
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("id, user_id, staff_number, full_name, role, department, email, phone")
        .not("user_id", "is", null)
        ;
      console.log("Staff data from table:", staffData);
      if (staffError) console.error("Staff error:", staffError);

      // Fetch actual portal roles from user_roles table to get correct mapping
      const { data: userRolesData } = await supabase.from("user_roles").select("user_id, role");
      const portalRoleMap: Record<string, string> = {};
      (userRolesData || []).forEach((r: any) => { portalRoleMap[r.user_id] = r.role; });

      const staffUsersFromTable: ManagedUser[] = (staffData || []).map((s: any) => ({
        id: s.user_id,
        email: s.email || `${s.staff_number}@mbsmavingtech.ac.zw`,
        full_name: s.full_name,
        portal_role: portalRoleMap[s.user_id] || "teacher",
        staff_role: s.role,
        department: s.department,
        created_at: new Date().toISOString(),
      }));
      console.log("Staff users from table count:", staffUsersFromTable.length);
      console.log("Staff users from table:", staffUsersFromTable);

      // 3. Fetch student users from students table (optional — table may not exist in demo)
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, user_id, admission_number, full_name, enrollment_date")
        .not("user_id", "is", null);
      if (studentsError) console.warn("Students table unavailable:", studentsError.message);

      const studentUsers: ManagedUser[] = (studentsData || []).map((s: any) => ({
        id: s.user_id,
        email: `mhs${(s.admission_number || "").toLowerCase().replace(/^mhs/, "")}@mbsmavingtech.ac.zw`,
        full_name: s.full_name,
        portal_role: "student",
        staff_role: undefined,
        department: undefined,
        created_at: s.enrollment_date,
      }));
      console.log("Student users count:", studentUsers.length);
      console.log("Student users:", studentUsers);

      // 4. Merge all sources (avoid duplicates by id)
      const combined = [...staffUsersFromEdge];
      for (const staff of staffUsersFromTable) {
        if (!combined.some((u) => u.id === staff.id)) {
          combined.push(staff);
        }
      }
      for (const student of studentUsers) {
        if (!combined.some((u) => u.id === student.id)) {
          combined.push(student);
        }
      }
      console.log("Combined users count:", combined.length);
      console.log("Combined users:", combined);

      setUsers(combined);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      toast({ title: "Error loading users", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      console.log("-- fetchUsers finished --");
    }
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast({ title: "Full name, email and password are required", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "create-user",
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          portal_role: form.portal_role,
          staff_role: ["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "bursar", "admin_supervisor", "registration"].includes(form.portal_role) ? form.staff_role : undefined,
          department: form.department || undefined,
          phone: form.phone || undefined,
          grade: form.grade || undefined,
          class_name: form.class_name || undefined,
          assigned_class_id:
            ["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "bursar", "admin_supervisor", "registration"].includes(form.portal_role) && form.assigned_class_id
              ? form.assigned_class_id
              : undefined,
          subjects_taught: form.subjects_taught.length > 0 ? form.subjects_taught : undefined,
          teaching_class_ids: form.teaching_class_ids.length > 0 ? form.teaching_class_ids : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Upload photo if provided
      if (createPhotoBlob && data.user_id) {
        const photoUrl = await uploadPhoto(createPhotoBlob, data.user_id, form.portal_role);
        if (photoUrl) {
          // Update the appropriate table with the photo URL
          if (form.portal_role === "student") {
            await supabase.from("students").update({ profile_photo_url: photoUrl }).eq("user_id", data.user_id);
          } else {
            await supabase.from("staff").update({ photo_url: photoUrl }).eq("user_id", data.user_id);
          }
          await supabase.from("profiles").update({ avatar_url: photoUrl }).eq("id", data.user_id);
        }
      }

      toast({ title: "User created successfully!" });
      setForm({
        full_name: "",
        email: "",
        password: "",
        portal_role: "teacher",
        staff_role: "teacher",
        department: "",
        phone: "",
        grade: "",
        class_name: "",
        assigned_class_id: "",
        subjects_taught: [],
        teaching_class_ids: [],
      });
      setCreatePhotoBlob(null);
      setCreatePhotoPreview(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  // Change password dialog state
  const [passwordTarget, setPasswordTarget] = useState<{ userId: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const openPasswordDialog = (userId: string, email: string) => {
    setPasswordTarget({ userId, email });
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setResettingPassword(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
        setResettingPassword(false);
        return;
      }
      const token = session.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "reset-password", user_id: passwordTarget.userId, password: newPassword }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Password changed successfully" });
      setPasswordTarget(null);
    } catch (err: any) {
      toast({ title: "Failed to change password", description: err.message, variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; email: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteUser = (userId: string, email: string) => {
    setDeleteTarget({ userId, email });
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const { userId } = deleteTarget;
    setDeleting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "delete-user", user_id: userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "User deleted" });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Failed to delete user", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Edit user state
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({
    portal_role: "",
    staff_role: "",
    department: "",
    full_name: "",
    assigned_class_id: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    qualifications: "",
    bio: "",
    title: "",
    subjects_taught: [] as string[],
    national_id: "",
    nssa_number: "",
    paye_number: "",
    bank_details: "",
    employment_date: "",
    photo_url: "",
  });
  const [saving, setSaving] = useState(false);

  const openEditDialog = async (user: ManagedUser) => {
    setEditUser(user);
    setEditPhotoBlob(null);
    setEditPhotoPreview(null);
    let currentClassId = "";
    let staffDetails: any = {};
    let photoUrl = "";
    if (["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "bursar", "admin_supervisor", "registration"].includes(user.portal_role)) {
      const { data: staffRecord } = await supabase.from("staff").select("*").eq("user_id", user.id).maybeSingle();
      if (staffRecord) {
        staffDetails = staffRecord;
        photoUrl = staffRecord.photo_url || "";
        const { data: classRecord } = await supabase
          .from("classes")
          .select("id")
          .eq("class_teacher_id", staffRecord.id)
          .maybeSingle();
        if (classRecord) currentClassId = classRecord.id;
      }
    } else if (user.portal_role === "student") {
      const { data: studentRecord } = await supabase
        .from("students")
        .select("profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (studentRecord) photoUrl = studentRecord.profile_photo_url || "";
    }
    if (!photoUrl) {
      const { data: profileRecord } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (profileRecord) photoUrl = profileRecord.avatar_url || "";
    }
    setEditForm({
      portal_role: user.portal_role,
      staff_role: user.staff_role || "teacher",
      department: user.department || "",
      full_name: user.full_name,
      assigned_class_id: currentClassId,
      phone: staffDetails.phone || "",
      email: staffDetails.email || user.email || "",
      address: staffDetails.address || "",
      emergency_contact: staffDetails.emergency_contact || "",
      qualifications: staffDetails.qualifications || "",
      bio: staffDetails.bio || "",
      title: staffDetails.title || "",
      subjects_taught: staffDetails.subjects_taught || [],
      national_id: staffDetails.national_id || "",
      nssa_number: staffDetails.nssa_number || "",
      paye_number: staffDetails.paye_number || "",
      bank_details: staffDetails.bank_details || "",
      employment_date: staffDetails.employment_date || "",
      photo_url: photoUrl,
    });
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const token = session.access_token;
      const isStaff = ["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "bursar", "admin_supervisor", "registration"].includes(editForm.portal_role);

      // Detect if email changed
      const emailChanged = editForm.email && editForm.email !== editUser.email;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "update-user",
          user_id: editUser.id,
          portal_role: editForm.portal_role,
          full_name: editForm.full_name,
          new_email: emailChanged ? editForm.email : undefined,
          staff_role: isStaff ? editForm.staff_role : undefined,
          department: isStaff ? editForm.department : undefined,
          assigned_class_id: isStaff && editForm.assigned_class_id ? editForm.assigned_class_id : undefined,
          phone: isStaff ? editForm.phone : undefined,
          email: isStaff ? editForm.email : undefined,
          address: isStaff ? editForm.address : undefined,
          emergency_contact: isStaff ? editForm.emergency_contact : undefined,
          qualifications: isStaff ? editForm.qualifications : undefined,
          bio: isStaff ? editForm.bio : undefined,
          title: isStaff ? editForm.title : undefined,
          subjects_taught: isStaff ? editForm.subjects_taught : undefined,
          national_id: isStaff ? editForm.national_id : undefined,
          nssa_number: isStaff ? editForm.nssa_number : undefined,
          paye_number: isStaff ? editForm.paye_number : undefined,
          bank_details: isStaff ? editForm.bank_details : undefined,
          employment_date: isStaff ? editForm.employment_date : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Upload photo if a new one was provided
      if (editPhotoBlob) {
        const photoUrl = await uploadPhoto(editPhotoBlob, editUser.id, editForm.portal_role);
        if (photoUrl) {
          if (editForm.portal_role === "student") {
            await supabase.from("students").update({ profile_photo_url: photoUrl }).eq("user_id", editUser.id);
          } else {
            await supabase.from("staff").update({ photo_url: photoUrl }).eq("user_id", editUser.id);
          }
          await supabase.from("profiles").update({ avatar_url: photoUrl }).eq("id", editUser.id);
        }
      } else if (!editForm.photo_url && !editPhotoPreview) {
        // Photo was removed
        if (editForm.portal_role === "student") {
          await supabase.from("students").update({ profile_photo_url: null }).eq("user_id", editUser.id);
        } else {
          await supabase.from("staff").update({ photo_url: null }).eq("user_id", editUser.id);
        }
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", editUser.id);
      }

      toast({ title: "User updated successfully" });
      setEditUser(null);
      setEditPhotoBlob(null);
      setEditPhotoPreview(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !searchQuery ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === "all" || u.portal_role === filterRole;
    return matchSearch && matchRole;
  });

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive" as const;
      case "teacher":
        return "default" as const;
      case "student":
        return "secondary" as const;
      case "parent":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const staffPortalRoles = ["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "bursar", "admin_supervisor", "registration"];
  const isStaffRole = staffPortalRoles.includes(form.portal_role);

  return (
    <Tabs defaultValue="create" className="space-y-4">
      <TabsList>
        <TabsTrigger value="create">
          <UserPlus className="mr-1 h-4 w-4" /> Create User
        </TabsTrigger>
        <TabsTrigger value="bulk">
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Bulk Import
        </TabsTrigger>
        <TabsTrigger value="list">
          <Users className="mr-1 h-4 w-4" /> All Users
        </TabsTrigger>
      </TabsList>

      <TabsContent value="create">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Shield className="h-5 w-5" /> Create New User Account
            </CardTitle>
            <CardDescription>
              Create portal accounts for teachers, administrators, HODs, students, and other staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Mr. T. Sibanda"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="user@mavingtech.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>Portal Access Role *</Label>
                <Select value={form.portal_role} onValueChange={(v) => setForm((p) => ({ ...p, portal_role: v, staff_role: portalToStaffDefault[v] || p.staff_role }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {portalRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isStaffRole && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Staff Position / Title</Label>
                    <Select value={form.staff_role} onValueChange={(v) => setForm((p) => ({ ...p, staff_role: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {staffRoles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={form.department} onValueChange={(v) => setForm((p) => ({ ...p, department: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
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
                </div>
                <div className="space-y-2">
                  <Label>Assigned Class (Class Teacher)</Label>
                  <Select
                    value={form.assigned_class_id || "none"}
                    onValueChange={(v) => setForm((p) => ({ ...p, assigned_class_id: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No class assigned</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.level ? ` (${c.level})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Teaching subjects assignment */}
                {["teacher", "hod", "senior_teacher"].includes(form.staff_role) && (
                  <div className="space-y-2">
                    <Label>Subjects Taught</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {subjectsList.map((subject) => (
                        <Badge
                          key={subject}
                          variant={form.subjects_taught.includes(subject) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = form.subjects_taught;
                            const updated = current.includes(subject)
                              ? current.filter((s) => s !== subject)
                              : [...current, subject];
                            setForm((p) => ({ ...p, subjects_taught: updated }));
                          }}
                        >
                          {subject}
                        </Badge>
                      ))}
                    </div>
                    {form.subjects_taught.length > 0 && (
                      <p className="text-sm text-muted-foreground">Selected: {form.subjects_taught.join(", ")}</p>
                    )}
                  </div>
                )}

                {/* Teaching classes assignment */}
                {["teacher", "hod", "senior_teacher"].includes(form.staff_role) && (
                  <div className="space-y-2">
                    <Label>Teaching Classes (classes this teacher will teach)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {classes.map((c) => (
                        <Badge
                          key={c.id}
                          variant={form.teaching_class_ids.includes(c.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = form.teaching_class_ids;
                            const updated = current.includes(c.id)
                              ? current.filter((id) => id !== c.id)
                              : [...current, c.id];
                            setForm((p) => ({ ...p, teaching_class_ids: updated }));
                          }}
                        >
                          {c.name}{c.level ? ` (${c.level})` : ""}
                        </Badge>
                      ))}
                    </div>
                    {form.teaching_class_ids.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {form.teaching_class_ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {form.portal_role === "student" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Select value={form.grade} onValueChange={(v) => setForm((p) => ({ ...p, grade: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stream</Label>
                  <Select value={form.class_name} onValueChange={(v) => setForm((p) => ({ ...p, class_name: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A", "B", "C", "D"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+263 7X XXX XXXX"
              />
            </div>

            {/* Profile Photo */}
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {createPhotoPreview ? (
                    <AvatarImage src={createPhotoPreview} alt="Preview" />
                  ) : (
                    <AvatarFallback className="text-lg">
                      {form.full_name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={createFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "create")}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => createFileRef.current?.click()}>
                    <Upload className="mr-1 h-4 w-4" /> Upload
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateWebcam(true)}>
                    <Camera className="mr-1 h-4 w-4" /> Take Photo
                  </Button>
                  {createPhotoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatePhotoBlob(null);
                        setCreatePhotoPreview(null);
                      }}
                    >
                      <X className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {creating ? "Creating Account..." : "Create User Account"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bulk">
        <BulkUserImport onImportComplete={fetchUsers} />
      </TabsContent>

      <TabsContent value="list">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Registered Users</CardTitle>
            <CardDescription>Manage all portal user accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {portalRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchUsers} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>

            {filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {loading ? "Loading users..." : "No users found"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Portal Role</TableHead>
                      <TableHead>Staff Position</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(u.portal_role)}>{u.portal_role}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.staff_role ? staffRoleLabels[u.staff_role] || u.staff_role.replace(/_/g, " ") : "—"}
                        </TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit user" onClick={() => openEditDialog(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Change password"
                              onClick={() => openPasswordDialog(u.id, u.email)}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete user"
                              onClick={() => confirmDeleteUser(u.id, u.email)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update details for {editUser?.email}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              {["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "admin_supervisor", "registration"].includes(editForm.portal_role) && (
                <>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                  <TabsTrigger value="subjects">Subjects</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Edit Photo */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {editPhotoPreview ? (
                      <AvatarImage src={editPhotoPreview} alt="Preview" />
                    ) : editForm.photo_url ? (
                      <AvatarImage src={editForm.photo_url} alt="Current" />
                    ) : (
                      <AvatarFallback className="text-lg">
                        {editForm.full_name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, "edit")}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                      <Upload className="mr-1 h-4 w-4" />{" "}
                      {editForm.photo_url || editPhotoPreview ? "Change Photo" : "Upload"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowEditWebcam(true)}>
                      <Camera className="mr-1 h-4 w-4" /> Take Photo
                    </Button>
                    {(editPhotoPreview || editForm.photo_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditPhotoBlob(null);
                          setEditPhotoPreview(null);
                          setEditForm((p) => ({ ...p, photo_url: "" }));
                        }}
                      >
                        <X className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Login Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                  {editUser && editForm.email && editForm.email !== editUser.email && (
                    <p className="text-xs text-amber-600">⚠ Email will be changed from {editUser.email}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title (e.g. Mr, Mrs, Dr)</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Portal Access Role</Label>
                <Select
                  value={editForm.portal_role}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, portal_role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {portalRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "admin_supervisor", "registration"].includes(editForm.portal_role) && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Staff Position</Label>
                      <Select
                        value={editForm.staff_role}
                        onValueChange={(v) => setEditForm((p) => ({ ...p, staff_role: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {staffRoles.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select
                        value={editForm.department || "none"}
                        onValueChange={(v) => setEditForm((p) => ({ ...p, department: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No department</SelectItem>
                          {departmentOptions.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Class (Class Teacher)</Label>
                    <Select
                      value={editForm.assigned_class_id || "none"}
                      onValueChange={(v) => setEditForm((p) => ({ ...p, assigned_class_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No class assigned</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {c.level ? ` (${c.level})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            {["teacher", "admin", "principal", "deputy_principal", "hod", "finance", "finance_clerk", "admin_supervisor", "registration"].includes(editForm.portal_role) && (
              <>
                <TabsContent value="contact" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="07XXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Emergency Contact</Label>
                      <Input
                        value={editForm.emergency_contact}
                        onChange={(e) => setEditForm((p) => ({ ...p, emergency_contact: e.target.value }))}
                        placeholder="07XXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>National ID</Label>
                      <Input
                        value={editForm.national_id}
                        onChange={(e) => setEditForm((p) => ({ ...p, national_id: e.target.value }))}
                        placeholder="XX-XXXXXXX-X-XX"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={editForm.address}
                      onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="employment" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Employment Date</Label>
                      <Input
                        type="date"
                        value={editForm.employment_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, employment_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Qualifications</Label>
                      <Input
                        value={editForm.qualifications}
                        onChange={(e) => setEditForm((p) => ({ ...p, qualifications: e.target.value }))}
                        placeholder="e.g. B.Ed, M.Sc"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>NSSA Number</Label>
                      <Input
                        value={editForm.nssa_number}
                        onChange={(e) => setEditForm((p) => ({ ...p, nssa_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ZIMRA PAYE / TIN Number</Label>
                      <Input
                        value={editForm.paye_number}
                        onChange={(e) => setEditForm((p) => ({ ...p, paye_number: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Details</Label>
                    <Textarea
                      value={editForm.bank_details}
                      onChange={(e) => setEditForm((p) => ({ ...p, bank_details: e.target.value }))}
                      rows={2}
                      placeholder="Bank name, account number, branch"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="subjects" className="space-y-4">
                  <Label>Subjects Taught</Label>
                  <div className="flex flex-wrap gap-2">
                    {subjectsList.map((subject) => (
                      <Badge
                        key={subject}
                        variant={editForm.subjects_taught.includes(subject) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const current = editForm.subjects_taught;
                          const updated = current.includes(subject)
                            ? current.filter((s) => s !== subject)
                            : [...current, subject];
                          setEditForm((p) => ({ ...p, subjects_taught: updated }));
                        }}
                      >
                        {subject}
                      </Badge>
                    ))}
                  </div>
                  {editForm.subjects_taught.length > 0 && (
                    <p className="text-sm text-muted-foreground">Selected: {editForm.subjects_taught.join(", ")}</p>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account for <strong>{deleteTarget?.email}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cropper & Webcam modals for Create */}
      <ImageCropper
        imageSrc={createCropSrc}
        open={showCreateCropper}
        onClose={() => setShowCreateCropper(false)}
        onCropComplete={(blob) => {
          setCreatePhotoBlob(blob);
          setCreatePhotoPreview(URL.createObjectURL(blob));
        }}
        title="Crop Profile Photo"
        cropShape="round"
      />
      <WebcamCapture
        open={showCreateWebcam}
        onClose={() => setShowCreateWebcam(false)}
        onCapture={(blob) => handleWebcamCapture(blob, "create")}
        title="Take Profile Photo"
      />

      {/* Cropper & Webcam modals for Edit */}
      <ImageCropper
        imageSrc={editCropSrc}
        open={showEditCropper}
        onClose={() => setShowEditCropper(false)}
        onCropComplete={(blob) => {
          setEditPhotoBlob(blob);
          setEditPhotoPreview(URL.createObjectURL(blob));
        }}
        title="Crop Profile Photo"
        cropShape="round"
      />
      <WebcamCapture
        open={showEditWebcam}
        onClose={() => setShowEditWebcam(false)}
        onCapture={(blob) => handleWebcamCapture(blob, "edit")}
        title="Take Profile Photo"
      />

      {/* Change Password Dialog */}
      <Dialog open={!!passwordTarget} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Change Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium">{passwordTarget?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="admin-new-pw"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? <X className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirm-pw">Confirm Password</Label>
              <Input
                id="admin-confirm-pw"
                type={showNewPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)} disabled={resettingPassword}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resettingPassword || !newPassword || newPassword !== confirmNewPassword}
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
