import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ImageCropper from "@/components/ImageCropper";
import { errorMessage } from "@/lib/errors";
import type { Tables } from "@/integrations/supabase/types";

export default function ProjectsManagement() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Tables<"school_projects">[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    const { data } = await supabase.from("school_projects").select("*").order("created_at", { ascending: false });
    if (data) setProjects(data);
  };

  const uploadFile = async (file: File | Blob, folder: string) => {
    const ext = file instanceof File ? file.name.split(".").pop() : "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("school-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("school-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    if (!title) {
      toast({ title: "Please enter a project title first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(blob, "projects");
      const { error } = await supabase.from("school_projects").insert({
        name: title,
        description: description || null,
        image_url: url,
      });
      if (error) throw error;
      toast({ title: "Project added!" });
      setTitle("");
      setDescription("");
      fetchProjects();
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const addProjectWithoutImage = async () => {
    if (!title) return;
    const { error } = await supabase.from("school_projects").insert({
      name: title,
      description: description || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Project added!" });
    setTitle("");
    setDescription("");
    fetchProjects();
  };

  const deleteProject = async (id: string) => {
    await supabase.from("school_projects").delete().eq("id", id);
    toast({ title: "Project removed" });
    fetchProjects();
  };

  return (
    <>
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          open={cropOpen}
          onClose={() => { setCropOpen(false); setCropSrc(null); }}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Crop Project Image"
        />
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-heading">Add School Project</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Science Fair 2026" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of the project" />
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="file" accept="image/*" ref={fileRef} onChange={handleFileSelect} className="hidden" />
              <Button onClick={() => { if (!title) { toast({ title: "Enter a title first", variant: "destructive" }); return; } fileRef.current?.click(); }} disabled={uploading}>
                <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Add with Image"}
              </Button>
              <Button variant="outline" onClick={addProjectWithoutImage} disabled={!title}>
                <Plus className="mr-1 h-4 w-4" /> Add without Image
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projects ({projects.length})</h3>
          {projects.map(p => (
            <Card key={p.id}>
              <CardContent className="flex items-start gap-3 p-4">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-20 w-28 shrink-0 rounded-md object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                  <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deleteProject(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
