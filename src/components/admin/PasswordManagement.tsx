import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, KeyRound, Eye, EyeOff, Copy, ShieldAlert, CheckCircle2, Lock, MessageCircle, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { demoPasswordFor, generatePassword } from "@/lib/passwords";

type PortalUser = {
  id: string;
  email: string;
  full_name: string;
  portal_role: string;
  last_sign_in_at?: string | null;
  must_change_password?: boolean;
  password_reset_at?: string | null;
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  student: "bg-purple-100 text-purple-800",
  teacher: "bg-green-100 text-green-800",
  parent: "bg-gray-200 text-gray-800",
  finance: "bg-amber-100 text-amber-800",
  principal: "bg-purple-700 text-white",
  deputy_principal: "bg-purple-300 text-purple-950",
  hod: "bg-gray-700 text-white",
  admin_supervisor: "bg-orange-100 text-orange-800",
  registration: "bg-gray-100 text-gray-700 border border-gray-300",
};

const PAGE_SIZE = 50;
const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function callManageUsers(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * Password management. Passwords are stored as one-way hashes, so nobody (not even an
 * administrator) can read an existing password. Admins can see the published demo
 * passwords, and set a new password for anyone, which is then shown once to pass on.
 */
export default function PasswordManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Reset password dialog
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [forceChange, setForceChange] = useState(true);
  const [done, setDone] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callManageUsers({ action: "list-users" });
      setUsers(data.users ?? []);
    } catch (err) {
      toast({ title: "Failed to load users", description: errorMessage(err), variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => (!q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        && (roleFilter === "all" || u.portal_role === roleFilter))
      .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
  }, [users, search, roleFilter]);

  useEffect(() => setShown(PAGE_SIZE), [search, roleFilter]);

  const uniqueRoles = [...new Set(users.map((u) => u.portal_role))].filter(Boolean).sort();

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied` });
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy it by hand.", variant: "destructive" });
    }
  };

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const openResetDialog = (user: PortalUser) => {
    setSelectedUser(user);
    setNewPassword(generatePassword());
    setShowPassword(true);
    setForceChange(true);
    setDone(false);
    setDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      const data = await callManageUsers({
        action: "reset-password",
        user_id: selectedUser.id,
        password: newPassword,
        force_change: forceChange,
      });
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id
        ? { ...u, must_change_password: data.must_change_password ?? forceChange, password_reset_at: data.password_reset_at ?? new Date().toISOString() }
        : u)));
      setDone(true);
    } catch (err) {
      toast({ title: "Failed to reset password", description: errorMessage(err), variant: "destructive" });
    }
    setResetting(false);
  };

  const signInDetails = selectedUser
    ? `MavingTech school portal\nSign in at: ${window.location.origin}/login\nEmail: ${selectedUser.email}\nPassword: ${newPassword}${forceChange ? "\nYou will be asked to choose your own password when you sign in." : ""}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Password Management</h2>
          <p className="text-sm text-muted-foreground">View demo passwords and set a new password for any portal user.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          For security, passwords are stored scrambled and can't be read back by anyone, including administrators.
          Demo account passwords are shown because they are published. For anyone else, use <strong>Reset Password</strong>:
          the new password is shown once so you can pass it on.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
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
                <TableHead>Password</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading users...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users found.</TableCell></TableRow>
              ) : filtered.slice(0, shown).map((u) => {
                const demo = u.password_reset_at ? null : demoPasswordFor(u.email, u.portal_role);
                const isRevealed = revealed.has(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[u.portal_role] || "bg-muted text-muted-foreground"}>{roleLabel(u.portal_role || "unknown")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {demo ? (
                        <div className="flex items-center gap-1">
                          <code className="font-mono">{isRevealed ? demo : "••••••••••"}</code>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleReveal(u.id)} aria-label={isRevealed ? "Hide password" : "Show password"}>
                            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(demo, "Password")} aria-label="Copy password">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : u.password_reset_at ? (
                        <span className="text-muted-foreground">Reset {shortDate(u.password_reset_at)}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Private</span>
                      )}
                      {u.must_change_password && <Badge variant="outline" className="mt-1 border-amber-300 text-amber-700">Must change at sign-in</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.last_sign_in_at ? shortDate(u.last_sign_in_at) : "Never"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openResetDialog(u)}>
                        <KeyRound className="mr-1 h-4 w-4" /> Reset Password
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!loading && filtered.length > shown && (
          <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
            <span>Showing {shown} of {filtered.length}</span>
            <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>Show more</Button>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">{done ? "New password set" : "Reset Password"}</DialogTitle>
            {done && <DialogDescription>Pass these sign-in details on now. The password is not shown again.</DialogDescription>}
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">{selectedUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                <Badge className={`mt-1 ${roleColors[selectedUser.portal_role] || ""}`}>{roleLabel(selectedUser.portal_role || "unknown")}</Badge>
              </div>

              {done ? (
                <>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                    <p className="mb-1 flex items-center gap-1 text-xs text-green-800 dark:text-green-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Password updated
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="break-all font-mono text-base font-bold">{newPassword}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(newPassword, "Password")} aria-label="Copy password">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {forceChange && <p className="mt-2 text-xs text-muted-foreground">They will be asked to choose their own password when they sign in.</p>}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" className="flex-1" onClick={() => copy(signInDetails, "Sign-in details")}>
                      <Copy className="mr-1 h-4 w-4" /> Copy sign-in details
                    </Button>
                    <Button variant="outline" className="flex-1" asChild>
                      <a href={`https://wa.me/?text=${encodeURIComponent(signInDetails)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-1 h-4 w-4" /> Share on WhatsApp
                      </a>
                    </Button>
                  </div>
                  <Button className="w-full" onClick={() => setDialogOpen(false)}>Done</Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setNewPassword(generatePassword()); setShowPassword(true); }} className="text-xs">
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate strong password
                    </Button>
                    <p className="text-xs text-muted-foreground">Common passwords (like "Password123") are refused by the system.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="forceChange" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} className="rounded border-input" />
                    <Label htmlFor="forceChange" className="flex cursor-pointer items-center gap-1 text-sm">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Ask them to choose their own password at next sign-in
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
                    <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8} className="flex-1">
                      {resetting ? "Resetting..." : "Reset Password"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
