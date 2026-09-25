import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Edit2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ImageCropper from "@/components/ImageCropper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/errors";
import { STAFF_COLUMNS } from "@/lib/staff";

const categoryOptions = [
  { value: "leadership", label: "Leadership" },
  { value: "teaching", label: "Teaching Staff" },
  { value: "admin", label: "Admin Staff" },
  { value: "general", label: "General Staff" },
];

type StaffMember = {
  id: string;
  full_name: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  category: string;
};

export default function StaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState("all");

  // Cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<{ type: "existing" | "group"; staffId?: string }>({ type: "group" });
  const [cropAspect, setCropAspect] = useState(1);
  const [cropShape, setCropShape] = useState<"round" | "rect">("round");

  const groupPhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStaff();
    fetchGroupPhoto();
  }, []);

  const fetchStaff = async () => {
    const { data } = await supabase.from("staff").select(STAFF_COLUMNS).order("full_name");
    if (data) setStaff(data as StaffMember[]);
  };

  const fetchGroupPhoto = async () => {
    const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", "staff_group_photo").limit(1);
    if (data && data.length > 0) setGroupPhotoUrl(data[0].setting_value);
  };

  const uploadFile = async (file: File | Blob, folder: string) => {
    const ext = file instanceof File ? file.name.split(".").pop() : "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("school-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("school-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const openCropperFromFile = (file: File, target: typeof cropTarget, aspect = 1, shape: "round" | "rect" = "round") => {
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropTarget(target);
      setCropAspect(aspect);
      setCropShape(shape);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    setUploading(true);
    try {
      const url = await uploadFile(blob, "staff");

      if (cropTarget.type === "group") {
        const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "staff_group_photo");
        if (existing && existing.length > 0) {
          await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", "staff_group_photo");
        } else {
          await supabase.from("site_settings").insert({ setting_key: "staff_group_photo", setting_value: url });
        }
        setGroupPhotoUrl(url);
        toast({ title: "Group photo updated!" });
      } else if (cropTarget.type === "existing" && cropTarget.staffId) {
        await supabase.from("staff").update({ photo_url: url }).eq("id", cropTarget.staffId);
        toast({ title: "Photo updated!" });
        fetchStaff();
      }
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleGroupPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropperFromFile(file, { type: "group" }, 16 / 9, "rect");
    if (groupPhotoRef.current) groupPhotoRef.current.value = "";
  };

  const handleExistingStaffPhoto = (staffId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropperFromFile(file, { type: "existing", staffId }, 1, "round");
  };

  const updateStaffCategory = async (id: string, category: string) => {
    await supabase.from("staff").update({ category }).eq("id", id);
    toast({ title: "Category updated" });
    fetchStaff();
  };

  const filteredStaff = filterCategory === "all" ? staff : staff.filter(s => s.category === filterCategory);
  const categoryLabel = (c: string) => categoryOptions.find(o => o.value === c)?.label || c;

  return (
    <div className="space-y-8">
      {/* Crop Dialog */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          open={cropOpen}
          onClose={() => { setCropOpen(false); setCropSrc(null); }}
          onCropComplete={handleCroppedUpload}
          aspectRatio={cropAspect}
          cropShape={cropShape}
          title={cropTarget.type === "group" ? "Crop Group Photo" : "Crop Staff Photo"}
        />
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          To add new staff members, use the <strong>Staff Directory</strong> tab where they will be issued login credentials. This tab is for managing how staff appear on the public website (photos, bios, categories).
        </AlertDescription>
      </Alert>

      {/* Group Photo Section */}
      <Card>
        <CardHeader><CardTitle className="font-heading">Staff Group Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This photo appears at the top of the Staff page.</p>
          <div className="flex items-start gap-6">
            <div>
              <input type="file" accept="image/*" ref={groupPhotoRef} onChange={handleGroupPhoto} className="hidden" />
              <Button onClick={() => groupPhotoRef.current?.click()} disabled={uploading}>
                <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload Group Photo"}
              </Button>
            </div>
            {groupPhotoUrl && (
              <img src={groupPhotoUrl} alt="Staff group" className="max-h-40 rounded-lg border object-cover" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading">Website Staff Display ({staff.length})</CardTitle>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredStaff.map(member => (
              <div key={member.id} className="flex items-center gap-4 rounded-lg border p-3">
                <div className="relative shrink-0">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.full_name} className="h-16 w-16 rounded-full object-cover object-top" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-light">
                      <span className="font-heading text-xl font-bold text-primary">{member.full_name[0]}</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id={`photo-${member.id}`}
                    onChange={(e) => handleExistingStaffPhoto(member.id, e)}
                  />
                  <button
                    onClick={() => document.getElementById(`photo-${member.id}`)?.click()}
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80"
                    title="Change photo (crop)"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{member.full_name}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {member.title && <span>{member.title}</span>}
                    {member.department && <span>• {member.department}</span>}
                  </div>
                  <span className="inline-block mt-1 rounded-full bg-maroon-light px-2 py-0.5 text-xs font-medium text-primary">
                    {categoryLabel(member.category)}
                  </span>
                  {member.bio && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{member.bio}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select value={member.category} onValueChange={(v) => updateStaffCategory(member.id, v)}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {filteredStaff.length === 0 && (
              <p className="text-center text-sm text-muted-foreground italic py-8">No staff members in this category.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}