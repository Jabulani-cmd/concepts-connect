import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Plus, Trophy, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ImageCropper from "@/components/ImageCropper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AwardsManagement() {
  const { toast } = useToast();
  const [awards, setAwards] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [studentName, setStudentName] = useState("");
  const [awardName, setAwardName] = useState("");
  const [yearIssued, setYearIssued] = useState(String(new Date().getFullYear()));
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [a, p] = await Promise.all([
      supabase.from("awards").select("*").order("year", { ascending: false }),
      supabase.from("award_photos").select("*").order("created_at", { ascending: false }),
    ]);
    if (a.data) setAwards(a.data);
    if (p.data) setPhotos(p.data);
  };

  const addAward = async () => {
    if (!studentName || !awardName) return;
    const { error } = await supabase.from("awards").insert({
      recipient: studentName,
      title: awardName,
      year: parseInt(yearIssued) || new Date().getFullYear(),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Award added!" });
    setStudentName(""); setAwardName(""); setYearIssued(String(new Date().getFullYear()));
    fetchAll();
  };

  const deleteAward = async (id: string) => {
    await supabase.from("awards").delete().eq("id", id);
    toast({ title: "Award removed" });
    fetchAll();
  };

  const uploadFile = async (file: Blob) => {
    const path = `awards/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("school-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("school-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const url = await uploadFile(blob);
      const { error } = await supabase.from("award_photos").insert({ image_url: url, caption: caption || null });
      if (error) throw error;
      toast({ title: "Photo uploaded!" });
      setCaption("");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const deletePhoto = async (id: string) => {
    await supabase.from("award_photos").delete().eq("id", id);
    toast({ title: "Photo removed" });
    fetchAll();
  };

  return (
    <>
      {cropSrc && (
        <ImageCropper imageSrc={cropSrc} open={cropOpen} onClose={() => { setCropOpen(false); setCropSrc(null); }}
          onCropComplete={handleCropComplete} aspectRatio={16 / 9} cropShape="rect" title="Crop Award Photo" />
      )}
      <Tabs defaultValue="awards-list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="awards-list"><Trophy className="mr-1 h-4 w-4" /> Awards List</TabsTrigger>
          <TabsTrigger value="awards-photos"><Image className="mr-1 h-4 w-4" /> Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="awards-list">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="font-heading">Add Award</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Student Name *</Label><Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Sipho Zulu" /></div>
                <div className="space-y-2"><Label>Award Name *</Label><Input value={awardName} onChange={e => setAwardName(e.target.value)} placeholder="e.g. Best in Mathematics" /></div>
                <div className="space-y-2"><Label>Year Issued</Label><Input type="number" value={yearIssued} onChange={e => setYearIssued(e.target.value)} /></div>
                <Button onClick={addAward} disabled={!studentName || !awardName}><Plus className="mr-1 h-4 w-4" /> Add Award</Button>
              </CardContent>
            </Card>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Awards ({awards.length})</h3>
              {awards.map(a => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="font-semibold">{a.recipient}</h3>
                      <p className="text-sm text-muted-foreground">{a.title} — {a.year}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteAward(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="awards-photos">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="font-heading">Upload Award Photo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Caption (optional)</Label><Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Prize-giving 2025" /></div>
                <input type="file" accept="image/*" ref={fileRef} onChange={handleFileSelect} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Choose Photo"}
                </Button>
              </CardContent>
            </Card>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Photos ({photos.length})</h3>
              {photos.map(p => (
                <Card key={p.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <img src={p.image_url} alt={p.caption || "Award"} className="h-20 w-28 shrink-0 rounded-md object-cover" />
                    <div className="flex-1 min-w-0">
                      {p.caption && <p className="text-sm text-muted-foreground">{p.caption}</p>}
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deletePhoto(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
