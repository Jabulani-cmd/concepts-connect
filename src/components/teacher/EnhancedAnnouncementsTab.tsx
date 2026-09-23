import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Megaphone, Upload, Trash2, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { ClassOption } from "@/types/school";
import type { Tables } from "@/integrations/supabase/types";

const targetTypes = [
  { value: "whole_school", label: "Whole School" },
  { value: "class", label: "Specific Class(es)" },
  { value: "form", label: "Form Level" },
  { value: "parents", label: "Parents Only" },
];

interface Props {
  userId: string;
  classes: ClassOption[];
  announcements: Tables<"announcements">[];
  myAnnouncements: Tables<"announcements">[];
  onRefresh: () => void;
}

export default function EnhancedAnnouncementsTab({ userId, classes, announcements, myAnnouncements, onRefresh }: Props) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewTab, setViewTab] = useState<"mine" | "all">("mine");

  const [form, setForm] = useState({
    title: "", content: "", is_public: true,
    target_type: "whole_school", target_ids: [] as string[],
    expires_at: ""
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleTargetClass = (classId: string) => {
    setForm(p => ({
      ...p,
      target_ids: p.target_ids.includes(classId)
        ? p.target_ids.filter(id => id !== classId)
        : [...p.target_ids, classId]
    }));
  };

  const postAnnouncement = async () => {
    if (!form.title || !form.content) {
      toast({ title: "Fill title and content", variant: "destructive" }); return;
    }
    setSubmitting(true);

    // Upload attachments
    const file_attachments: string[] = [];
    for (const file of attachments) {
      const path = `announcements/${userId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("school-media").upload(path, file);
      if (!error) {
        const url = supabase.storage.from("school-media").getPublicUrl(path).data.publicUrl;
        file_attachments.push(url);
      }
    }

    const { error } = await supabase.from("announcements").insert({
      title: form.title,
      content: form.content,
      is_public: form.is_public,
      author_id: userId,
      target_type: form.target_type,
      target_ids: form.target_ids.length > 0 ? form.target_ids : null,
      file_attachments: file_attachments.length > 0 ? file_attachments : null,
      expires_at: form.expires_at || null,
    });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Announcement posted!" });
      setForm({ title: "", content: "", is_public: true, target_type: "whole_school", target_ids: [], expires_at: "" });
      setAttachments([]);
      setShowCreate(false);
      onRefresh();
    }
    setSubmitting(false);
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    onRefresh();
    toast({ title: "Announcement deleted" });
  };

  const displayList = viewTab === "mine" ? myAnnouncements : announcements;

  const formLevels = [...new Set(classes.map(c => c.level).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={viewTab === "mine" ? "secondary" : "ghost"} size="sm" onClick={() => setViewTab("mine")}>My Announcements ({myAnnouncements.length})</Button>
          <Button variant={viewTab === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setViewTab("all")}>All Public ({announcements.length})</Button>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4" /> New Announcement</Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Post Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" /></div>
            <div className="space-y-2"><Label>Content *</Label><Textarea rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your announcement..." /></div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={form.target_type} onValueChange={v => setForm(p => ({ ...p, target_type: v, target_ids: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{targetTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {form.target_type === "class" && (
              <div className="space-y-2">
                <Label>Select Classes</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded border p-2">
                  {classes.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={form.target_ids.includes(c.id)}
                        onCheckedChange={() => toggleTargetClass(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.target_type === "form" && (
              <div className="space-y-2">
                <Label>Select Form Levels</Label>
                <div className="flex flex-wrap gap-2">
                  {formLevels.map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={form.target_ids.includes(f)}
                        onCheckedChange={() => toggleTargetClass(f)}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-sm">
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" /> Add File
              </Button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={e => {
                if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
              }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
              </div>
              <div className="flex items-end pb-2 gap-2">
                <Switch checked={form.is_public} onCheckedChange={v => setForm(p => ({ ...p, is_public: v }))} />
                <Label>Public</Label>
              </div>
            </div>

            <Button onClick={postAnnouncement} disabled={submitting} className="w-full">{submitting ? "Posting..." : "Post Announcement"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List */}
      {displayList.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No announcements yet.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {displayList.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Megaphone className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="font-medium text-sm">{a.title}</p>
                      {a.target_type && a.target_type !== "whole_school" && (
                        <Badge variant="outline" className="text-[10px]">{a.target_type}</Badge>
                      )}
                      {a.is_public && <Badge className="text-[10px]">Public</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-3">{a.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy h:mm a")}</span>
                      {a.expires_at && <Badge variant="outline" className="text-[10px]">Expires {format(new Date(a.expires_at), "MMM d")}</Badge>}
                      {a.file_attachments && a.file_attachments.length > 0 && (
                        <Badge variant="outline" className="text-[10px]"><Paperclip className="mr-0.5 h-2.5 w-2.5" />{a.file_attachments.length} file(s)</Badge>
                      )}
                    </div>
                    {a.file_attachments && a.file_attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.file_attachments.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                            Attachment {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {a.author_id === userId && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => deleteAnnouncement(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
