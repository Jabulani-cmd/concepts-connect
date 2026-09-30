import { useEffect, useRef, useState } from "react";
import { ExternalLink, Eye, EyeOff, ImagePlus, Link2, Loader2, Play, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import {
  GALLERY_CATEGORIES,
  MAX_VIDEO_MB,
  categoryLabel,
  galleryKind,
  galleryThumbnail,
  isVideo,
  isVideoLink,
  type GalleryItem,
} from "@/lib/gallery";
import { removeMedia, uploadMedia } from "@/lib/mediaUpload";

/** Admin screen for the public gallery: add photos, videos and video links; hide or remove them. */
export default function GalleryManagement() {
  const { toast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("general");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("gallery_images").select("*").order("created_at", { ascending: false });
    setItems((data as GalleryItem[] | null) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (urls: string[]) => {
    const rows = urls.map((image_url) => ({ image_url, caption: caption.trim() || null, category, is_active: true }));
    const { error } = await supabase.from("gallery_images").insert(rows);
    if (error) throw error;
  };

  const addPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (photoRef.current) photoRef.current.value = "";
    if (!list.length) return;
    const urls: string[] = [];
    try {
      for (const [i, f] of list.entries()) {
        setBusy(`Uploading photo ${i + 1} of ${list.length}…`);
        urls.push(await uploadMedia(f, "gallery"));
      }
      await save(urls);
      toast({ title: list.length === 1 ? "Photo added to the gallery" : `${list.length} photos added to the gallery` });
      setCaption("");
    } catch (e) {
      if (urls.length) await save(urls).catch(() => undefined);
      toast({ title: "Upload failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
      load();
    }
  };

  const addVideo = async (file: File | undefined) => {
    if (videoRef.current) videoRef.current.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast({
        title: `Video is larger than ${MAX_VIDEO_MB} MB`,
        description: "Put longer videos on YouTube (they can be unlisted) and add the link instead.",
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy(`Uploading video (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
      await save([await uploadMedia(file, "gallery")]);
      toast({ title: "Video added to the gallery" });
      setCaption("");
    } catch (e) {
      toast({ title: "Video upload failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
      load();
    }
  };

  const addLink = async () => {
    const url = link.trim();
    if (!isVideoLink(url)) {
      toast({ title: "Not a YouTube or Vimeo link", description: "Paste the video's address, e.g. https://youtu.be/…", variant: "destructive" });
      return;
    }
    try {
      setBusy("Adding video…");
      await save([url]);
      toast({ title: "Video added to the gallery" });
      setLink("");
      setCaption("");
    } catch (e) {
      toast({ title: "Could not add the video", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
      load();
    }
  };

  const toggle = async (item: GalleryItem) => {
    const { error } = await supabase.from("gallery_images").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) toast({ title: "Could not update", description: errorMessage(error), variant: "destructive" });
    else toast({ title: item.is_active ? "Hidden from the website" : "Shown on the website" });
    load();
  };

  const remove = async (item: GalleryItem) => {
    if (!window.confirm("Remove this from the gallery for good?")) return;
    const { error } = await supabase.from("gallery_images").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Could not remove", description: errorMessage(error), variant: "destructive" });
      return;
    }
    await removeMedia(item.image_url);
    toast({ title: "Removed from the gallery" });
    load();
  };

  const videos = items.filter((i) => isVideo(i.image_url)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-heading">Add to the Gallery</CardTitle>
          <p className="text-sm text-muted-foreground">Photos and videos appear on the public Gallery page straight away.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gallery-caption">Caption (optional)</Label>
            <Input id="gallery-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Inter-house Athletics 2026" />
          </div>
          <div className="space-y-2">
            <Label>Album</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GALLERY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={(e) => addVideo(e.target.files?.[0])} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => photoRef.current?.click()} disabled={!!busy}>
              <ImagePlus className="mr-1.5 h-4 w-4" /> Add photos
            </Button>
            <Button variant="outline" onClick={() => videoRef.current?.click()} disabled={!!busy}>
              <Video className="mr-1.5 h-4 w-4" /> Upload video
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">You can pick several photos at once. Large photos are resized for fast loading. Video files up to {MAX_VIDEO_MB} MB (MP4 works on every phone).</p>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="gallery-link">Or add a YouTube / Vimeo video</Label>
            <div className="flex gap-2">
              <Input id="gallery-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" inputMode="url" />
              <Button variant="outline" onClick={addLink} disabled={!!busy || !link.trim()} aria-label="Add video link">
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {busy && (
            <p className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> {busy}
            </p>
          )}
          <a href="/gallery" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View the public gallery <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Gallery ({items.length - videos} photos, {videos} videos)
        </h3>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing in the gallery yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const still = galleryThumbnail(item.image_url);
              return (
                <div key={item.id} className={`overflow-hidden rounded-lg border bg-card ${item.is_active ? "" : "opacity-60"}`}>
                  <div className="relative aspect-square bg-muted">
                    {still ? (
                      <img src={still} alt={item.caption || ""} loading="lazy" className="h-full w-full object-cover" />
                    ) : galleryKind(item.image_url) === "video" ? (
                      <video src={`${item.image_url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-purple-900" />
                    )}
                    {isVideo(item.image_url) && (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Play className="h-3 w-3 fill-current" /> Video
                      </span>
                    )}
                    {!item.is_active && <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Hidden</span>}
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium">{item.caption || <span className="text-muted-foreground">No caption</span>}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{categoryLabel(item.category)}</p>
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" variant="outline" className="h-8 flex-1 px-2 text-xs" onClick={() => toggle(item)}>
                        {item.is_active ? <><EyeOff className="mr-1 h-3.5 w-3.5" /> Hide</> : <><Eye className="mr-1 h-3.5 w-3.5" /> Show</>}
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(item)} aria-label="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
