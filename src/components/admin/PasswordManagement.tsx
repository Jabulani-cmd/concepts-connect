import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, KeyRound, Eye, EyeOff, Copy, ShieldAlert } from "lucide-react";
import { errorMessage } from "@/lib/errors";

type PortalUser = {
  id: string;
  email: string;
  full_name: string;
  portal_role: string;
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  student: "bg-blue-100 text-blue-800",
  teacher: "bg-green-100 text-green-800",
  parent: "bg-purple-100 text-purple-800",
  finance: "bg-amber-100 text-amber-800",
  principal: "bg-indigo-100 text-indigo-800",
  deputy_principal: "bg-teal-100 text-teal-800",
  hod: "bg-cyan-100 text-cyan-800",
  admin_supervisor: "bg-orange-100 text-orange-800",
  registration: "bg-pink-100 text-pink-800",
};

export default function PasswordManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Reset password dialog
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [forceChange, setForceChange] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
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
          body: JSON.stringify({ action: "list-users" }),
        }
      );
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      toast({ title: "Failed to load users", description: errorMessage(err), variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.portal_role === roleFilter;
    return matchSearch && matchRole;
  });

  const uniqueRoles = [...new Set(users.map(u => u.portal_role))].filter(Boolean).sort();

  const openResetDialog = (user: PortalUser) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowPassword(false);
    setForceChange(true);
    setDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Reset the password
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
            action: "reset-password",
            user_id: selectedUser.id,
            password: newPassword,
            force_change: forceChange,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: "Password reset successfully", description: `Password updated for ${selectedUser.full_name}` });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Failed to reset password", description: errorMessage(err), variant: "destructive" });
    }
    setResetting(false);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pwd);
    setShowPassword(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Password Management</h2>
          <p className="text-sm text-muted-foreground">Reset passwords for any portal user across all roles.</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map(r => (
                <SelectItem key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading users...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
              ) : filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[u.portal_role] || "bg-muted text-muted-foreground"}>
                      {u.portal_role?.replace("_", " ") || "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openResetDialog(u)}>
                      <KeyRound className="mr-1 h-4 w-4" /> Reset Password
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Reset Password</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">{selectedUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                <Badge className={`mt-1 ${roleColors[selectedUser.portal_role] || ""}`}>
                  {selectedUser.portal_role?.replace("_", " ")}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={generatePassword} className="text-xs">
                  Generate Strong Password
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceChange"
                  checked={forceChange}
                  onChange={e => setForceChange(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="forceChange" className="text-sm cursor-pointer flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  Force password change on next login
                </Label>
              </div>

              {newPassword && showPassword && (
                <div className="rounded border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">New password:</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-sm">{newPassword}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword);
                        toast({ title: "Password copied" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleResetPassword} disabled={resetting || !newPassword} className="flex-1">
                  {resetting ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
