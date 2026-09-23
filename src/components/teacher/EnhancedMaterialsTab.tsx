import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Trash2, Download, Eye, EyeOff, Search, Grid3X3, List,
  FileText, Video, Link2, Presentation, X, Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const materialTypes = ["document", "video", "link", "presentation"];
const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-5 w-5" />,
  video: <Video className="h-5 w-5" />,
  link: <Link2 className="h-5 w-5" />,
  presentation: <Presentation className="h-5 w-5" />,
};

interface Props {
  userId: string;
  classes: any[];
  subjects: any[];
  materials: any[];
  onRefresh: () => void;
}

export default function EnhancedMaterialsTab({ userId, classes, subjects, materials, onRefresh }: Props) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "downloads">("date");
  const [dragOver, setDragOver] = useState(false);

  // Upload form
  const [form, setForm] = useState({
    title: "", description: "", class_id: "", subject_id: "",
    material_type: "document", link_url: "", is_published: true,
    expiry_date: "", tags: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!form.title) setForm(p => ({ ...p, title: droppedFile.name.split(".")[0] }));
      setShowUpload(true);
    }
  }, [form.title]);

  const uploadMaterial = async () => {
    if (!form.title || !form.class_id || !form.subject_id) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    if (form.material_type !== "link" && !file) {
      toast({ title: "Select a file", variant: "destructive" }); return;
    }
    if (form.material_type === "link" && !form.link_url) {
      toast({ title: "Enter a URL", variant: "destructive" }); return;
    }

    setUploading(true);
    let file_url = null;

    if (file) {
      const ext = file.name.split(".").pop();
      const path = `materials/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("school-media").upload(path, file);
      if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setUploading(false); return; }
      file_url = supabase.storage.from("school-media").getPublicUrl(path).data.publicUrl;
    }

    const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : null;

    const { error } = await supabase.from("study_materials").insert({
      teacher_id: userId, title: form.title,
      description: form.description || null,
      class_id: form.class_id, subject_id: form.subject_id,
      material_type: form.material_type, file_url,
      link_url: form.link_url || null, is_published: form.is_published,
      expiry_date: form.expiry_date || null, tags,
    });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Material uploaded!" });
      await supabase.from("notifications").insert({
        user_id: userId, title: "Material Uploaded",
        message: `"${form.title}" has been published.`, type: "material"
      });
      setForm({ title: "", description: "", class_id: "", subject_id: "", material_type: "document", link_url: "", is_published: true, expiry_date: "", tags: "" });
      setFile(null);
      setShowUpload(false);
      onRefresh();
    }
    setUploading(false);
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("study_materials").delete().eq("id", id);
    onRefresh();
    toast({ title: "Material deleted" });
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("study_materials").update({ is_published: !current }).eq("id", id);
    onRefresh();
  };

  // Filter & sort
  const filtered = materials
    .filter(m => {
      if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterClass !== "all" && m.class_id !== filterClass) return false;
      if (filterSubject !== "all" && m.subject_id !== filterSubject) return false;
      if (filterType !== "all" && m.material_type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "downloads") return (b.download_count || 0) - (a.download_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-4"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-primary bg-primary/5 p-12 text-center">
            <Upload className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-2 text-lg font-medium text-primary">Drop file to upload</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search materials..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{materialTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest</SelectItem>
            <SelectItem value="title">Title A-Z</SelectItem>
            <SelectItem value="downloads">Most Downloads</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("grid")}><Grid3X3 className="h-4 w-4" /></Button>
        </div>
        <Button onClick={() => setShowUpload(true)}><Upload className="mr-1 h-4 w-4" /> Upload</Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Upload Study Material</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Chapter 5 Notes" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Class *</Label>
                <Select value={form.class_id} onValueChange={v => setForm(p => ({ ...p, class_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject *</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(p => ({ ...p, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={form.material_type} onValueChange={v => setForm(p => ({ ...p, material_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{materialTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.material_type === "link" ? (
              <div className="space-y-2"><Label>URL *</Label><Input value={form.link_url} onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))} placeholder="https://..." /></div>
            ) : (
              <div className="space-y-2">
                <Label>File *</Label>
                <div className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-1">{file ? file.name : "Click or drag file here"}</p>
                </div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.mp4,.mov" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="notes, chapter5" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
              <Label>Publish immediately</Label>
            </div>
            <Button onClick={uploadMaterial} disabled={uploading} className="w-full">{uploading ? "Uploading..." : "Upload Material"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Materials Display */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {materials.length === 0 ? "No materials uploaded yet. Click Upload to get started!" : "No materials match your filters."}
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => (
            <Card key={m.id} className="overflow-hidden">
              <div className="flex h-20 items-center justify-center bg-muted">
                <div className="text-muted-foreground">{typeIcons[m.material_type] || <FileText className="h-8 w-8" />}</div>
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="font-medium text-sm truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.classes?.name} • {m.subjects?.name}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={m.is_published ? "default" : "secondary"} className="text-[10px]">{m.is_published ? "Published" : "Draft"}</Badge>
                  <Badge variant="outline" className="text-[10px]">{m.material_type}</Badge>
                  {m.download_count > 0 && <Badge variant="outline" className="text-[10px]">{m.download_count} downloads</Badge>}
                </div>
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{m.tags.map((t: string) => <span key={t} className="inline-flex items-center rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"><Tag className="mr-0.5 h-2.5 w-2.5" />{t}</span>)}</div>
                )}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePublish(m.id, m.is_published)}>{m.is_published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                  {(m.file_url || m.link_url) && <Button variant="ghost" size="icon" className="h-7 w-7" asChild><a href={m.file_url || m.link_url} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /></a></Button>}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMaterial(m.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  {typeIcons[m.material_type] || <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.classes?.name} • {m.subjects?.name} • {format(new Date(m.created_at), "MMM d")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant={m.is_published ? "default" : "secondary"} className="text-[10px]">{m.is_published ? "Published" : "Draft"}</Badge>
                    {m.download_count > 0 && <Badge variant="outline" className="text-[10px]">{m.download_count} ↓</Badge>}
                    {m.tags?.map((t: string) => <span key={t} className="inline-flex items-center rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">{t}</span>)}
                    {m.expiry_date && <Badge variant="outline" className="text-[10px]">Expires {format(new Date(m.expiry_date), "MMM d")}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(m.id, m.is_published)}>{m.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                {(m.file_url || m.link_url) && <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={m.file_url || m.link_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a></Button>}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMaterial(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
