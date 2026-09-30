import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Play, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { MAX_VIDEO_MB, galleryKind } from "@/lib/gallery";
import { removeMedia, uploadMedia } from "@/lib/mediaUpload";
import { CAROUSEL_QUERY } from "@/lib/siteMedia";

type Slide = Tables<"carousel_images">;

/** Admin screen for the home page slideshow: pictures and short videos, in order. */
export default function CarouselManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("carousel_images").select("*").order("display_order");
    setSlides(data ?? []);
    queryClient.invalidateQueries({ queryKey: CAROUSEL_QUERY });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextOrder = () => (slides.length ? Math.max(...slides.map((s) => s.display_order)) + 1 : 0);

  const add = async (files: File[], kind: "photo" | "video") => {
    if (!files.length) return;
    let order = nextOrder();
    let added = 0;
    try {
      for (const [i, f] of files.entries()) {
        setBusy(kind === "video" ? `Uploading video (${(f.size / 1024 / 1024).toFixed(1)} MB)…` : `Uploading picture ${i + 1} of ${files.length}…`);
        const url = await uploadMedia(f, "carousel");
        const { error } = await supabase.from("carousel_images").insert({ image_url: url, caption: caption.trim() || null, display_order: order++, is_active: true });
        if (error) throw error;
        added++;
      }
      toast({ title: added === 1 ? "Slide added to the home page" : `${added} slides added to the home page` });
      setCaption("");
    } catch (e) {
      toast({ title: "Upload failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
      load();
    }
  };

  const move = async (index: number, step: -1 | 1) => {
    const other = slides[index + step];
    const slide = slides[index];
    if (!other) return;
    const results = await Promise.all([
      supabase.from("carousel_images").update({ display_order: other.display_order }).eq("id", slide.id),
      supabase.from("carousel_images").update({ display_order: slide.display_order }).eq("id", other.id),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast({ title: "Could not reorder", description: errorMessage(failed.error), variant: "destructive" });
    load();
  };

  // Older slides may share an order number; number them 0, 1, 2… once so moving works.
  const renumbered = useRef(false);
  useEffect(() => {
    const orders = slides.map((s) => s.display_order);
    if (renumbered.current || new Set(orders).size === orders.length) return;
    renumbered.current = true;
    Promise.all(slides.map((s, i) => supabase.from("carousel_images").update({ display_order: i }).eq("id", s.id))).then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  const toggle = async (slide: Slide) => {
    const { error } = await supabase.from("carousel_images").update({ is_active: !slide.is_active }).eq("id", slide.id);
    if (error) toast({ title: "Could not update", description: errorMessage(error), variant: "destructive" });
    load();
  };

  const remove = async (slide: Slide) => {
    if (!window.confirm("Remove this slide from the home page for good?")) return;
    const { error } = await supabase.from("carousel_images").delete().eq("id", slide.id);
    if (error) {
      toast({ title: "Could not remove", description: errorMessage(error), variant: "destructive" });
      return;
    }
    await removeMedia(slide.image_url);
    toast({ title: "Slide removed" });
    load();
  };

  const shown = slides.filter((s) => s.is_active).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-heading">Home Page Slideshow</CardTitle>
          <p className="text-sm text-muted-foreground">
            The large pictures at the top of the home page. Wide (landscape) pictures work best. Until you add a slide, the built-in pictures are shown.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carousel-caption">Description (optional)</Label>
            <Input id="carousel-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Speech Day 2026" />
          </div>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; add(f, "photo"); }} />
          <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; add(f, "video"); }} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => photoRef.current?.click()} disabled={!!busy}>
              <ImagePlus className="mr-1.5 h-4 w-4" /> Add pictures
            </Button>
            <Button variant="outline" onClick={() => videoRef.current?.click()} disabled={!!busy}>
              <Video className="mr-1.5 h-4 w-4" /> Add video
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pictures are resized for fast loading on phones. Videos play silently and move to the next slide when they end; keep them short (up to {MAX_VIDEO_MB} MB, MP4).
          </p>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> {busy}
            </p>
          )}
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View the home page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Slides ({shown} shown{slides.length > shown ? `, ${slides.length - shown} hidden` : ""})
        </h3>
        {slides.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No slides yet. The home page is showing its built-in pictures.</p>
        ) : (
          <ol className="space-y-2">
            {slides.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-3 rounded-lg border bg-card p-2 ${s.is_active ? "" : "opacity-60"}`}>
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-muted sm:h-20 sm:w-36">
                  {galleryKind(s.image_url) === "video" ? (
                    <>
                      <video src={`${s.image_url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <Play className="absolute left-1 top-1 h-4 w-4 fill-white text-white drop-shadow" />
                    </>
                  ) : (
                    <img src={s.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.caption || <span className="text-muted-foreground">No description</span>}</p>
                  {!s.is_active && <p className="text-xs text-muted-foreground">Hidden</p>}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === slides.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggle(s)} aria-label={s.is_active ? "Hide" : "Show"}>
                    {s.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(s)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
