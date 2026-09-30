import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { MAX_VIDEO_MB, galleryKind } from "@/lib/gallery";
import { removeMedia, uploadMedia } from "@/lib/mediaUpload";
import { MEDIA_SLOTS, SITE_MEDIA_QUERY, fetchSiteMedia, saveSiteMedia, type MediaSlot } from "@/lib/siteMedia";

const PAGE_LINKS: Record<string, string> = {
  Home: "/",
  About: "/about",
  Academics: "/academics",
  Admissions: "/admissions",
  Contact: "/contact",
  Gallery: "/gallery",
};

const SHAPE_HINT: Record<MediaSlot["shape"], string> = {
  banner: "Wide picture or short video",
  landscape: "Landscape picture",
  portrait: "Portrait (tall) picture",
  square: "Square picture",
};

const PREVIEW: Record<MediaSlot["shape"], string> = {
  banner: "aspect-[16/7]",
  landscape: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
};

/** Admin screen listing every replaceable picture on the website, page by page. */
export default function SiteMediaManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: uploaded = {}, isLoading } = useQuery({ queryKey: SITE_MEDIA_QUERY, queryFn: fetchSiteMedia, staleTime: 0 });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<MediaSlot | null>(null);

  const pages = [...new Set(MEDIA_SLOTS.map((s) => s.page))];

  const pick = (slot: MediaSlot) => {
    setTarget(slot);
    if (inputRef.current) {
      inputRef.current.accept = slot.allowVideo ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*";
      inputRef.current.click();
    }
  };

  const replace = async (file: File | undefined) => {
    const slot = target;
    if (!file || !slot) return;
    if (file.type.startsWith("video/") && !slot.allowVideo) {
      toast({ title: "Pictures only here", description: "Videos can be used for page banners and the home page slideshow.", variant: "destructive" });
      return;
    }
    setBusyKey(slot.key);
    try {
      const previous = uploaded[slot.key];
      const url = await uploadMedia(file, "site-images");
      await saveSiteMedia(slot.key, url);
      await removeMedia(previous);
      toast({ title: `${slot.page}: ${slot.label} updated` });
    } catch (e) {
      toast({ title: "Upload failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: SITE_MEDIA_QUERY });
    }
  };

  const reset = async (slot: MediaSlot) => {
    if (!window.confirm(`Go back to the original ${slot.label.toLowerCase()} on the ${slot.page} page?`)) return;
    setBusyKey(slot.key);
    try {
      const previous = uploaded[slot.key];
      await saveSiteMedia(slot.key, null);
      await removeMedia(previous);
      toast({ title: "Original picture restored" });
    } catch (e) {
      toast({ title: "Could not restore", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: SITE_MEDIA_QUERY });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Website Images</h2>
        <p className="text-sm text-muted-foreground">
          Replace any picture on the public website. Page banners can also be a short silent video (up to {MAX_VIDEO_MB} MB, MP4). The home page slideshow is in the
          Carousel tab, and gallery photos and videos are in the Gallery tab.
        </p>
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; replace(f); }} />

      {pages.map((page) => (
        <Card key={page}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="font-heading text-lg">{page} page</CardTitle>
            <a href={PAGE_LINKS[page] ?? "/"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {MEDIA_SLOTS.filter((s) => s.page === page).map((slot) => {
                const custom = uploaded[slot.key];
                const src = custom || slot.fallback;
                const busy = busyKey === slot.key;
                return (
                  <div key={slot.key} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                    <div className={`relative ${PREVIEW[slot.shape]} max-h-48 w-full bg-muted`}>
                      {isLoading ? null : galleryKind(src) === "video" ? (
                        <video src={src} muted autoPlay loop playsInline className="h-full w-full object-cover" />
                      ) : (
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${custom ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"}`}>
                        {custom ? "Uploaded" : "Original"}
                      </span>
                      {busy && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-2.5">
                      <div>
                        <p className="text-sm font-medium leading-tight">{slot.label}</p>
                        <p className="text-[11px] text-muted-foreground">{SHAPE_HINT[slot.shape]}</p>
                      </div>
                      <div className="mt-auto flex gap-1">
                        <Button size="sm" className="h-8 flex-1 px-2 text-xs" onClick={() => pick(slot)} disabled={!!busyKey}>
                          <Upload className="mr-1 h-3.5 w-3.5" /> Replace
                        </Button>
                        {custom && (
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => reset(slot)} disabled={!!busyKey} aria-label="Use the original picture" title="Use the original picture">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
