import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ImageCropper from "@/components/ImageCropper";

const facilityTypes = [
  { value: "boarding", label: "Boarding Facilities" },
  { value: "classrooms", label: "Classrooms" },
  { value: "sports", label: "Sports Facilities" },
  { value: "labs", label: "Laboratories" },
  { value: "library", label: "Library" },
  { value: "clubs", label: "Clubs & Societies" },
  { value: "ict", label: "ICT & Computer Labs" },
  { value: "dining", label: "Dining Hall" },
  { value: "assembly", label: "Assembly & Chapel" },
  { value: "general", label: "General" },
];

export default function FacilitiesManagement() {
  const { toast } = useToast();
  const [images, setImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [facilityType, setFacilityType] = useState("boarding");
  const [filterType, setFilterType] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => { fetchImages(); }, []);

  const fetchImages = async () => {
    const { data } = await supabase.from("facility_images").select("*").order("created_at", { ascending: false });
    if (data) setImages(data);
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
    setUploading(true);
    try {
      const file = new File([blob], `facility_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "facilities");
      const { error } = await supabase.from("facility_images").insert({
        image_url: url,
        caption: caption || null,
        facility_type: facilityType,
      });
      if (error) throw error;
      toast({ title: "Facility image added!" });
      setCaption("");
      fetchImages();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const deleteImage = async (id: string) => {
    await supabase.from("facility_images").delete().eq("id", id);
    toast({ title: "Image removed" });
    fetchImages();
  };

  const filtered = filterType === "all" ? images : images.filter(img => img.facility_type === filterType);
  const typeLabel = (v: string) => facilityTypes.find(t => t.value === v)?.label || v;

  return (
    <div className="space-y-6">
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          open={cropOpen}
          onClose={() => { setCropOpen(false); setCropSrc(null); }}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Crop Facility Image"
        />
      )}
      <Card>
        <CardHeader><CardTitle className="font-heading">Upload Facility Image</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Facility Type</Label>
              <Select value={facilityType} onValueChange={setFacilityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {facilityTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Caption (optional)</Label>
              <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Boys' Hostel Common Room" />
            </div>
          </div>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleFileSelect} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-4">
            <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Choose Image"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading">Facility Images ({images.length})</CardTitle>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {facilityTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(img => (
                <div key={img.id} className="group relative overflow-hidden rounded-lg border">
                  <img src={img.image_url} alt={img.caption || "Facility"} className="h-36 w-full object-cover" />
                  <div className="p-2">
                    <span className="inline-block rounded-full bg-maroon-light px-2 py-0.5 text-xs font-medium text-primary">{typeLabel(img.facility_type)}</span>
                    {img.caption && <p className="mt-1 text-xs text-muted-foreground truncate">{img.caption}</p>}
                  </div>
                  <Button variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteImage(img.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground italic py-8">No facility images uploaded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
