import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, Plus, Send, FileText, Users, Bell, Trash2,
  Eye, Clock, CheckCircle, AlertCircle, Search, Mail, Smartphone,
  Copy, Variable
} from "lucide-react";
import { format } from "date-fns";
import { errorMessage } from "@/lib/errors";

type Template = Tables<"sms_templates">;
type CommLog = Tables<"communication_logs">;
type Notification = Tables<"notifications">;
type StudentRecipient = Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form" | "user_id" | "guardian_phone" | "guardian_email">;
type StaffRecipient = Pick<Tables<"staff">, "id" | "full_name" | "email" | "phone" | "user_id">;
type ParentLink = Pick<Tables<"parent_students">, "parent_id" | "student_id">;

const templateCategories = ["fee_reminder", "attendance", "exam_results", "meeting", "emergency", "general"];
const recipientTypes = [
  { value: "all_parents", label: "All Parents" },
  { value: "class_parents", label: "Parents of Specific Form" },
  { value: "all_staff", label: "All Staff" },
  { value: "all_students", label: "All Students" },
  { value: "custom", label: "Custom Selection" },
];
const channelOptions = [
  { value: "sms", label: "SMS", icon: Smartphone },
  { value: "email", label: "Email", icon: Mail },
  { value: "notification", label: "In-App Notification", icon: Bell },
];
const formLevels = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const defaultTemplates = [
  { name: "Fee Reminder", category: "fee_reminder", body: "Dear Parent/Guardian of {{student_name}}, this is a reminder that fees of ${{balance}} for {{term}} are due by {{due_date}}. Please make payment at your earliest convenience. MavingTech High School.", variables: ["student_name", "balance", "term", "due_date"] },
  { name: "Attendance Alert", category: "attendance", body: "Dear Parent/Guardian, {{student_name}} was marked {{status}} on {{date}}. Please contact the school if you have any concerns. MavingTech High School.", variables: ["student_name", "status", "date"] },
  { name: "Exam Results Released", category: "exam_results", body: "Dear Parent/Guardian, {{exam_name}} results for {{student_name}} are now available on the student portal. Please log in to view. MavingTech High School.", variables: ["exam_name", "student_name"] },
  { name: "Meeting Notice", category: "meeting", body: "Dear {{recipient_name}}, you are invited to {{meeting_title}} on {{date}} at {{time}}, {{venue}}. Your attendance is important. MavingTech High School.", variables: ["recipient_name", "meeting_title", "date", "time", "venue"] },
  { name: "Emergency Closure", category: "emergency", body: "URGENT: MavingTech High School will be closed on {{date}} due to {{reason}}. Students should remain at home. Normal operations resume on {{resume_date}}.", variables: ["date", "reason", "resume_date"] },
];

export default function CommunicationModule() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("compose");

  // Data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [students, setStudents] = useState<StudentRecipient[]>([]);
  const [staff, setStaff] = useState<StaffRecipient[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);

  // Compose form
  const [recipientType, setRecipientType] = useState("all_parents");
  const [formFilter, setFormFilter] = useState("all");
  const [channel, setChannel] = useState("notification");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Template form
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "", body: "", category: "general", variables: ""
  });

  // Notification center
  const [notifSearch, setNotifSearch] = useState("");
  const [notifFilter, setNotifFilter] = useState("all");

  // Bulk notification dialog
  const [notifDialog, setNotifDialog] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTargetType, setNotifTargetType] = useState("all_students");
  const [notifTargetForm, setNotifTargetForm] = useState("all");

  const fetchAll = useCallback(() => {
    fetchTemplates();
    fetchLogs();
    fetchNotifications();
    fetchStudents();
    fetchStaff();
    fetchParentLinks();
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("sms_templates").select("*").order("category");
    if (data) setTemplates(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from("communication_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setNotifications(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("students").select("id, full_name, admission_number, form, user_id, guardian_phone, guardian_email").eq("status", "active").order("full_name");
    if (data) setStudents(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from("staff").select("id, full_name, email, phone, user_id").order("full_name");
    if (data) setStaff(data);
  };

  const fetchParentLinks = async () => {
    const { data } = await supabase.from("parent_students").select("parent_id, student_id");
    if (data) setParentLinks(data);
  };

  // Portal accounts of parents linked to the given students
  const parentUserIds = (forStudents: StudentRecipient[]): string[] => {
    const studentIds = new Set(forStudents.map(s => s.id));
    return [...new Set(parentLinks.filter(l => studentIds.has(l.student_id)).map(l => l.parent_id))];
  };

  const studentsInForm = (form: string) => students.filter(s => form === "all" || s.form === form);

  // Template CRUD
  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) return;
    const vars = templateForm.variables.split(",").map(v => v.trim()).filter(Boolean);
    const { error } = await supabase.from("sms_templates").insert({
      name: templateForm.name, body: templateForm.body,
      category: templateForm.category, variables: vars
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template saved!" });
    setTemplateDialog(false);
    setTemplateForm({ name: "", body: "", category: "general", variables: "" });
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("sms_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  const seedDefaultTemplates = async () => {
    const { error } = await supabase.from("sms_templates").insert(defaultTemplates);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Default templates added!" });
    fetchTemplates();
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const t = templates.find(t => t.id === templateId);
    if (t) {
      setMessageText(t.body);
      setSubject(t.name);
    }
  };

  // Get recipient count
  const getRecipientCount = (): number => {
    switch (recipientType) {
      case "all_parents":
        return students.filter(s => s.guardian_phone || s.guardian_email).length;
      case "class_parents":
        return students.filter(s => (formFilter === "all" || s.form === formFilter) && (s.guardian_phone || s.guardian_email)).length;
      case "all_staff":
        return staff.length;
      case "all_students":
        return formFilter === "all" ? students.length : students.filter(s => s.form === formFilter).length;
      default:
        return 0;
    }
  };

  // Get target user IDs for in-app notifications
  const getTargetUserIds = (): string[] => {
    switch (recipientType) {
      case "all_students":
        return studentsInForm(formFilter).filter(s => s.user_id).map(s => s.user_id!);
      case "all_staff":
        return staff.filter(s => s.user_id).map(s => s.user_id!);
      case "all_parents":
        return parentUserIds(students);
      case "class_parents":
        return parentUserIds(studentsInForm(formFilter));
      default:
        return [];
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageText.trim()) { toast({ title: "Message is empty", variant: "destructive" }); return; }
    setSending(true);

    try {
      const recipientCount = getRecipientCount();

      if (channel === "notification") {
        // Send in-app notifications
        const targetIds = getTargetUserIds();
        if (targetIds.length === 0) {
          toast({ title: "No recipients with accounts found", description: "In-app notifications can only be sent to users with portal accounts.", variant: "destructive" });
          setSending(false);
          return;
        }
        const notifs = targetIds.map(uid => ({
          user_id: uid,
          title: subject || "Message from Admin",
          message: messageText,
          type: "admin_message"
        }));
        // Insert in batches of 100
        for (let i = 0; i < notifs.length; i += 100) {
          const batch = notifs.slice(i, i + 100);
          await supabase.from("notifications").insert(batch);
        }
        // Log the communication
        await supabase.from("communication_logs").insert({
          recipient_type: recipientType,
          recipient_count: targetIds.length,
          body: messageText,
          subject: subject || null,
          channel: "notification",
          status: "sent",
          sent_at: new Date().toISOString(),
          user_id: user?.id,
          template_id: selectedTemplate || null
        });
        toast({ title: `Notification sent to ${targetIds.length} recipients!` });
      } else if (channel === "sms" || channel === "email") {
        // SMS/Email - log as pending since no provider is configured yet
        await supabase.from("communication_logs").insert({
          recipient_type: recipientType,
          recipient_count: recipientCount,
          body: messageText,
          subject: subject || null,
          channel,
          status: "pending",
          user_id: user?.id,
          template_id: selectedTemplate || null,
          error_message: "SMS/Email provider not configured yet. Message logged for sending when provider is set up."
        });
        toast({
          title: `${channel.toUpperCase()} logged (${recipientCount} recipients)`,
          description: "SMS/Email provider not yet configured. Message saved for future sending.",
        });
      }

      setMessageText("");
      setSubject("");
      setSelectedTemplate("");
      setPreviewOpen(false);
      fetchLogs();
      fetchNotifications();
    } catch (err) {
      toast({ title: "Send failed", description: errorMessage(err), variant: "destructive" });
    }
    setSending(false);
  };

  // Bulk notification send
  const sendBulkNotification = async () => {
    if (!notifTitle.trim()) return;
    let targetIds: string[] = [];
    if (notifTargetType === "all_students") {
      targetIds = studentsInForm(notifTargetForm).filter(s => s.user_id).map(s => s.user_id!);
    } else if (notifTargetType === "all_staff") {
      targetIds = staff.filter(s => s.user_id).map(s => s.user_id!);
    } else if (notifTargetType === "all_parents") {
      targetIds = parentUserIds(studentsInForm(notifTargetForm));
    }
    if (targetIds.length === 0) {
      toast({ title: "No recipients found", variant: "destructive" }); return;
    }
    const notifs = targetIds.map(uid => ({
      user_id: uid, title: notifTitle, message: notifMessage || null, type: "admin_message"
    }));
    for (let i = 0; i < notifs.length; i += 100) {
      await supabase.from("notifications").insert(notifs.slice(i, i + 100));
    }
    toast({ title: `Notification sent to ${targetIds.length} users!` });
    setNotifDialog(false);
    setNotifTitle("");
    setNotifMessage("");
    fetchNotifications();
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter(n => {
    const matchSearch = !notifSearch || n.title.toLowerCase().includes(notifSearch.toLowerCase()) || (n.message || "").toLowerCase().includes(notifSearch.toLowerCase());
    const matchFilter = notifFilter === "all" || (notifFilter === "read" && n.is_read) || (notifFilter === "unread" && !n.is_read) || n.type === notifFilter;
    return matchSearch && matchFilter;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-green-600/10 text-green-700 border-green-200">Sent</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "scheduled": return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">Scheduled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const channelBadge = (ch: string) => {
    switch (ch) {
      case "sms": return <Badge variant="outline"><Smartphone className="mr-1 h-3 w-3" /> SMS</Badge>;
      case "email": return <Badge variant="outline"><Mail className="mr-1 h-3 w-3" /> Email</Badge>;
      case "notification": return <Badge variant="outline"><Bell className="mr-1 h-3 w-3" /> In-App</Badge>;
      default: return <Badge variant="outline">{ch}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Templates", value: templates.length, icon: FileText, color: "text-primary" },
          { label: "Messages Sent", value: logs.filter(l => l.status === "sent").length, icon: Send, color: "text-green-600" },
          { label: "Pending", value: logs.filter(l => l.status === "pending").length, icon: Clock, color: "text-orange-500" },
          { label: "Total Notifications", value: notifications.length, icon: Bell, color: "text-blue-500" },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-maroon">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="compose"><Send className="mr-1 h-4 w-4" /> Compose</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="mr-1 h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="history"><Clock className="mr-1 h-4 w-4" /> History</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" /> Notifications</TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compose Message</CardTitle>
                  <CardDescription>Send messages to parents, students, or staff</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Recipients */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Recipients</Label>
                      <Select value={recipientType} onValueChange={setRecipientType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {recipientTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(recipientType === "class_parents" || recipientType === "all_students") && (
                      <div>
                        <Label>Form</Label>
                        <Select value={formFilter} onValueChange={setFormFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Forms</SelectItem>
                            {formLevels.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Channel */}
                  <div>
                    <Label>Channel</Label>
                    <div className="flex gap-2 mt-1">
                      {channelOptions.map(ch => (
                        <Button
                          key={ch.value}
                          variant={channel === ch.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChannel(ch.value)}
                        >
                          <ch.icon className="mr-1 h-4 w-4" /> {ch.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Template */}
                  <div>
                    <Label>Use Template (optional)</Label>
                    <Select value={selectedTemplate} onValueChange={applyTemplate}>
                      <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subject (for email/notification) */}
                  {(channel === "email" || channel === "notification") && (
                    <div>
                      <Label>Subject</Label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Message subject" />
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <Label>Message</Label>
                    <Textarea value={messageText} onChange={e => setMessageText(e.target.value)} rows={5} placeholder="Type your message here... Use {{variable_name}} for dynamic content" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {messageText.length} characters • Available variables: {"{{student_name}}, {{balance}}, {{date}}"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button onClick={() => setPreviewOpen(true)} variant="outline" disabled={!messageText.trim()}>
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Button>
                    <Button onClick={sendMessage} disabled={sending || !messageText.trim()}>
                      <Send className="mr-1 h-4 w-4" /> {sending ? "Sending..." : "Send Now"}
                    </Button>
                  </div>

                  {(channel === "sms" || channel === "email") && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                      <AlertCircle className="inline mr-1 h-4 w-4" />
                      <strong>Note:</strong> SMS/Email provider not yet configured. Messages will be logged for sending once a provider (e.g., Africa's Talking, Twilio) is connected.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Recipient Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-3xl font-bold text-primary">{getRecipientCount()}</p>
                    <p className="text-sm text-muted-foreground">recipients</p>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="font-medium">{recipientTypes.find(r => r.value === recipientType)?.label}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Channel:</span><span className="font-medium capitalize">{channel === "notification" ? "In-App" : channel.toUpperCase()}</span></div>
                    {formFilter !== "all" && <div className="flex justify-between"><span className="text-muted-foreground">Form:</span><span className="font-medium">{formFilter}</span></div>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setRecipientType("all_parents"); setChannel("notification"); setSubject("Fee Reminder"); applyTemplate(templates.find(t => t.category === "fee_reminder")?.id || ""); }}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Fee Reminder
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setRecipientType("all_parents"); setChannel("notification"); setSubject("Meeting Notice"); applyTemplate(templates.find(t => t.category === "meeting")?.id || ""); }}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Meeting Notice
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setRecipientType("all_students"); setChannel("notification"); setSubject("Emergency Notice"); setMessageText(""); }}>
                    <AlertCircle className="mr-2 h-4 w-4" /> Emergency Alert
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Message Templates</CardTitle>
                  <CardDescription>Reusable message templates with variable placeholders</CardDescription>
                </div>
                <div className="flex gap-2">
                  {templates.length === 0 && (
                    <Button variant="outline" size="sm" onClick={seedDefaultTemplates}>
                      <Copy className="mr-1 h-4 w-4" /> Load Defaults
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setTemplateDialog(true)}>
                    <Plus className="mr-1 h-4 w-4" /> New Template
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>No templates yet. Click "Load Defaults" to add common templates.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map(t => (
                    <Card key={t.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{t.name}</h4>
                            <Badge variant="outline" className="text-[10px] mt-1">{t.category}</Badge>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{t.body}</p>
                        {t.variables && t.variables.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {t.variables.map(v => (
                              <Badge key={v} variant="secondary" className="text-[10px]">
                                <Variable className="mr-0.5 h-2.5 w-2.5" />{v}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => { setActiveTab("compose"); applyTemplate(t.id); }}>
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Communication History</CardTitle>
              <CardDescription>Log of all sent and pending messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No messages sent yet</TableCell></TableRow>
                    ) : logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_at), "MMM d, h:mm a")}</TableCell>
                        <TableCell>{channelBadge(log.channel)}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{log.recipient_count}</span>
                            <span className="block text-xs text-muted-foreground">{(log.recipient_type ?? "").replace(/_/g, " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {log.subject && <span className="block text-xs font-medium">{log.subject}</span>}
                          <span className="text-xs text-muted-foreground line-clamp-2">{log.body}</span>
                        </TableCell>
                        <TableCell>
                          {statusBadge(log.status)}
                          {log.error_message && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{log.error_message}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Notification Center</CardTitle>
                  <CardDescription>All in-app notifications sent across the system</CardDescription>
                </div>
                <Button size="sm" onClick={() => setNotifDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Send Notification
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search notifications..." value={notifSearch} onChange={e => setNotifSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={notifFilter} onValueChange={setNotifFilter}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="announcement">Announcements</SelectItem>
                    <SelectItem value="exam_result">Exam Results</SelectItem>
                    <SelectItem value="material">Materials</SelectItem>
                    <SelectItem value="admin_message">Admin Messages</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-primary">{notifications.length}</p>
                    <p className="text-xs text-muted-foreground">Total Sent</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{notifications.filter(n => n.is_read).length}</p>
                    <p className="text-xs text-muted-foreground">Read</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-orange-500">{notifications.filter(n => !n.is_read).length}</p>
                    <p className="text-xs text-muted-foreground">Unread</p>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotifications.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No notifications found</TableCell></TableRow>
                    ) : filteredNotifications.slice(0, 50).map(n => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(n.created_at), "MMM d, h:mm a")}</TableCell>
                        <TableCell className="font-medium text-sm">{n.title}</TableCell>
                        <TableCell className="max-w-[200px] text-xs text-muted-foreground line-clamp-2">{n.message || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{n.type.replace("_", " ")}</Badge></TableCell>
                        <TableCell>
                          {n.is_read ? (
                            <Badge variant="secondary" className="text-[10px]"><CheckCircle className="mr-1 h-3 w-3" /> Read</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Unread</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Preview</DialogTitle>
            <DialogDescription>Review before sending</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipients:</span>
              <span className="font-medium">{getRecipientCount()} {recipientType.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Channel:</span>
              <span className="font-medium capitalize">{channel === "notification" ? "In-App" : channel.toUpperCase()}</span>
            </div>
            {subject && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subject:</span><span className="font-medium">{subject}</span></div>}
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{messageText}</p>
            </div>
            <p className="text-xs text-muted-foreground">Variables like {"{{student_name}}"} will be replaced with actual values for each recipient.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={sendMessage} disabled={sending}>
              <Send className="mr-1 h-4 w-4" /> {sending ? "Sending..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Message Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fee Reminder" /></div>
            <div>
              <Label>Category</Label>
              <Select value={templateForm.category} onValueChange={v => setTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{templateCategories.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message Template *</Label>
              <Textarea value={templateForm.body} onChange={e => setTemplateForm(p => ({ ...p, body: e.target.value }))} rows={4} placeholder="Dear {{recipient_name}}, your balance is ${{balance}}..." />
            </div>
            <div>
              <Label>Variables (comma-separated)</Label>
              <Input value={templateForm.variables} onChange={e => setTemplateForm(p => ({ ...p, variables: e.target.value }))} placeholder="student_name, balance, due_date" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveTemplate}>Save Template</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Notification Dialog */}
      <Dialog open={notifDialog} onOpenChange={setNotifDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send In-App Notification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Target Audience</Label>
              <Select value={notifTargetType} onValueChange={setNotifTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_students">All Students</SelectItem>
                  <SelectItem value="all_parents">Parents</SelectItem>
                  <SelectItem value="all_staff">All Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {notifTargetType !== "all_staff" && (
              <div>
                <Label>Form</Label>
                <Select value={notifTargetForm} onValueChange={setNotifTargetForm}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {formLevels.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Title *</Label><Input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} /></div>
            <div><Label>Message</Label><Textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={sendBulkNotification} disabled={!notifTitle.trim()}><Send className="mr-1 h-4 w-4" /> Send</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
