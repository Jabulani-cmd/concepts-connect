import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Phone, Mail, MapPin, AlertTriangle, Lock, Shield, Calendar, Hash, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  profile: Tables<"profiles"> | null;
  student: Tables<"students"> | null;
  studentClassName?: string | null;
  onRefresh: () => void;
}

export default function StudentProfileTab({ profile, student, studentClassName, onRefresh }: Props) {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    phone: profile?.phone || "",
    address: student?.address || "",
    emergency_contact: student?.emergency_contact || "",
  });

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (passwords.new.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.new });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated successfully!" });
      setShowPasswordDialog(false);
      setPasswords({ current: "", new: "", confirm: "" });
    }
    setChangingPassword(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const updates: PromiseLike<{ error: PostgrestError | null }>[] = [];

    // Update profile phone
    if (profile?.id) {
      updates.push(
        supabase.from("profiles").update({ phone: editForm.phone || null }).eq("id", profile.id)
      );
    }

    // Update student address and emergency contact
    if (student?.id) {
      updates.push(
        supabase.from("students").update({
          address: editForm.address || null,
          emergency_contact: editForm.emergency_contact || null,
        }).eq("id", student.id)
      );
    }

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast({ title: "Error saving changes", variant: "destructive" });
    } else {
      toast({ title: "Profile updated!" });
      setShowEditDialog(false);
      onRefresh();
    }
    setSaving(false);
  };

  const infoItems = [
    { icon: Hash, label: "Admission No.", value: student?.admission_number },
    { icon: User, label: "Full Name", value: student?.full_name || profile?.full_name },
    { icon: Mail, label: "Email", value: student?.email || profile?.email },
    { icon: Calendar, label: "Date of Birth", value: student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-GB") : null },
    { icon: Shield, label: "Form / Class", value: studentClassName || `${student?.form || profile?.grade || "—"}${student?.stream ? ` ${student.stream}` : ""}` },
    { icon: Phone, label: "Phone", value: profile?.phone },
    { icon: MapPin, label: "Address", value: student?.address },
    { icon: Phone, label: "Guardian", value: student?.guardian_name },
    { icon: Phone, label: "Guardian Phone", value: student?.guardian_phone },
    { icon: Phone, label: "Emergency Contact", value: student?.emergency_contact },
  ].filter((i) => i.value);

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 overflow-hidden">
              {(student?.profile_photo_url || profile?.avatar_url) ? (
                <img
                  src={student?.profile_photo_url || profile?.avatar_url}
                  alt={student?.full_name || profile?.full_name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-secondary" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{student?.full_name || profile?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{student?.form} {student?.stream}</p>
              <p className="text-xs text-muted-foreground">{student?.admission_number}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowEditDialog(true)} title="Edit Profile">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Medical Alert */}
      {student?.has_medical_alert && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Medical Alert</p>
              <p className="text-xs text-muted-foreground">{student.medical_conditions || "Please contact school nurse for details."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {infoItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm truncate">{item.value}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setShowEditDialog(true)}
        >
          <Pencil className="h-4 w-4 mr-2" /> Update Personal Information
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setShowPasswordDialog(true)}
        >
          <Lock className="h-4 w-4 mr-2" /> Change Password
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={signOut}
        >
          <User className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Personal Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Phone Number</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. +263 77 123 4567"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Your home address"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Emergency Contact</Label>
              <Input
                value={editForm.emergency_contact}
                onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact: e.target.value }))}
                placeholder="Emergency contact number"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Confirm Password</Label>
              <Input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            <Button onClick={handlePasswordChange} disabled={changingPassword} className="w-full">
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
