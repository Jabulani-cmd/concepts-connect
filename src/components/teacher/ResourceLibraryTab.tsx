import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Star, StarOff, ExternalLink, Link2, FileText, Video, Image, FolderOpen, Search, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SubjectOption } from "@/types/school";
import type { Tables } from "@/integrations/supabase/types";

type Resource = Tables<"teacher_resources"> & { subjects?: { name: string } | null };

interface Props {
  userId: string;
  subjects: SubjectOption[];
}

const typeIcons: Record<string, LucideIcon> = { link: Link2, document: FileText, video: Video, image: Image };
const resourceTypes = ["link", "document", "video", "image", "other"];

export default function ResourceLibraryTab({ userId, subjects }: Props) {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject_id: "", title: "", description: "", resource_type: "link", url: "", tags: "" });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const fetchResources = useCallback(async () => {
    const { data } = await supabase
      .from("teacher_resources")
      .select("*, subjects(name)")
      .eq("teacher_id", userId)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setResources(data);
  }, [userId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const handleSubmit = async () => {
    if (!form.title) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.from("teacher_resources").insert({
      teacher_id: userId,
      subject_id: form.subject_id || null,
      title: form.title,
      description: form.description || null,
      resource_type: form.resource_type,
      file_url: form.url || null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Resource saved!" });
      setForm({ subject_id: "", title: "", description: "", resource_type: "link", url: "", tags: "" });
      setDialogOpen(false);
      fetchResources();
    }
    setLoading(false);
  };

  const toggleFav = async (id: string, current: boolean) => {
    await supabase.from("teacher_resources").update({ is_favorite: !current }).eq("id", id);
    fetchResources();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("teacher_resources").delete().eq("id", id);
    toast({ title: "Resource removed" });
    fetchResources();
  };

  const filtered = resources.filter(r => {
    if (filterSubject !== "all" && r.subject_id !== filterSubject) return false;
    if (filterType !== "all" && r.resource_type !== filterType) return false;
    if (showFavOnly && !r.is_favorite) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || (r.tags || []).some((t: string) => t.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Resource Library</h2>
          <p className="text-sm text-muted-foreground">Organize your teaching resources, links, and reference materials.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add Resource</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Add Resource</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. ZIMSEC Past Papers 2025" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={v => setForm(p => ({ ...p, subject_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.resource_type} onValueChange={v => setForm(p => ({ ...p, resource_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{resourceTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>URL</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. past papers, revision, form 4" /></div>
              <Button onClick={handleSubmit} disabled={loading} className="w-full">{loading ? "Saving..." : "Save Resource"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {resourceTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showFavOnly ? "default" : "outline"} size="sm" onClick={() => setShowFavOnly(!showFavOnly)}>
          <Star className="h-4 w-4 mr-1" /> Favorites
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No resources found. Start building your library!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => {
            const Icon = typeIcons[r.resource_type] || FileText;
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">{r.subjects?.name || "General"}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                      {r.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleFav(r.id, r.is_favorite)}>
                        {r.is_favorite ? <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-3.5 w-3.5" />}
                      </Button>
                      {r.file_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
