import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Images, Play, X } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHero from "@/components/layout/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  GALLERY_CATEGORIES,
  categoryLabel,
  galleryEmbedUrl,
  galleryKind,
  galleryThumbnail,
  isVideo,
  type GalleryItem,
} from "@/lib/gallery";
import hero from "@/assets/activity-music.jpg";

type MediaFilter = "all" | "photos" | "videos";

export default function Gallery() {
  const { t } = useTranslation();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<MediaFilter>("all");
  const [album, setAlbum] = useState<string>("all");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("gallery_images")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as GalleryItem[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  const albumName = (value: string | null) => t(`gallery.categories.${value || "general"}`, { defaultValue: categoryLabel(value) });

  // Only albums that have something in them are offered.
  const albums = useMemo(() => {
    const used = new Set(items.map((i) => i.category || "general"));
    return GALLERY_CATEGORIES.filter((c) => used.has(c.value)).map((c) => c.value as string)
      .concat([...used].filter((u) => !GALLERY_CATEGORIES.some((c) => c.value === u)));
  }, [items]);

  const shown = useMemo(
    () =>
      items.filter((i) => {
        if (media === "photos" && isVideo(i.image_url)) return false;
        if (media === "videos" && !isVideo(i.image_url)) return false;
        return album === "all" || (i.category || "general") === album;
      }),
    [items, media, album],
  );

  const videoCount = items.filter((i) => isVideo(i.image_url)).length;

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/80 hover:border-primary/50 hover:text-primary",
    );

  return (
    <Layout>
      <PageHero eyebrow={t("gallery.eyebrow")} title={t("gallery.title")} subtitle={t("gallery.subtitle")} image={hero} />

      <section className="py-12 md:py-20">
        <div className="container">
          {items.length > 0 && (
            <div className="mb-8 space-y-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                <button type="button" className={chip(media === "all")} onClick={() => setMedia("all")}>{t("gallery.all")} ({items.length})</button>
                <button type="button" className={chip(media === "photos")} onClick={() => setMedia("photos")}>{t("gallery.photos")} ({items.length - videoCount})</button>
                <button type="button" className={chip(media === "videos")} onClick={() => setMedia("videos")}>{t("gallery.videos")} ({videoCount})</button>
              </div>
              {albums.length > 1 && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  <button type="button" className={chip(album === "all")} onClick={() => setAlbum("all")}>{t("gallery.allAlbums")}</button>
                  {albums.map((a) => (
                    <button key={a} type="button" className={chip(album === a)} onClick={() => setAlbum(a)}>{albumName(a)}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <Images className="mx-auto mb-4 h-12 w-12 text-primary/40" />
              <p className="text-muted-foreground">{items.length === 0 ? t("gallery.empty") : t("gallery.emptyFilter")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {shown.map((item, i) => (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                  onClick={() => setOpen(i)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted text-left shadow-sm outline-none ring-primary focus-visible:ring-2"
                  aria-label={item.caption || (isVideo(item.image_url) ? t("gallery.playVideo") : t("gallery.openPhoto"))}
                >
                  <Thumb url={item.image_url} alt={item.caption || ""} />
                  {isVideo(item.image_url) && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
                        <Play className="ml-0.5 h-6 w-6 fill-current" />
                      </span>
                    </span>
                  )}
                  {item.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-xs font-medium leading-snug text-white sm:text-sm">
                      <span className="line-clamp-2">{item.caption}</span>
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      {open !== null && shown[open] && (
        <Lightbox items={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} albumName={albumName} />
      )}
    </Layout>
  );
}

function Thumb({ url, alt }: { url: string; alt: string }) {
  const still = galleryThumbnail(url);
  const cls = "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105";
  if (still) return <img src={still} alt={alt} loading="lazy" decoding="async" className={cls} />;
  if (galleryKind(url) === "video") {
    // The first frame of the video stands in for a picture.
    return <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className={cls} />;
  }
  return <div className="h-full w-full bg-gradient-to-br from-purple-800 to-purple-950" />;
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  albumName,
}: {
  items: GalleryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  albumName: (v: string | null) => string;
}) {
  const { t } = useTranslation();
  const item = items[index];
  const touchX = useRef<number | null>(null);
  const go = useCallback((step: number) => onIndex((index + step + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  const kind = galleryKind(item.image_url);
  const embed = galleryEmbedUrl(item.image_url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || t("gallery.title")}
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-white sm:px-5">
        <span className="text-sm text-white/70">
          {index + 1} / {items.length}
        </span>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {kind === "image" && <img key={item.id} src={item.image_url} alt={item.caption || ""} className="max-h-full max-w-full rounded object-contain" />}
        {kind === "video" && (
          <video key={item.id} src={item.image_url} controls autoPlay playsInline className="max-h-full max-w-full rounded bg-black" />
        )}
        {embed && (
          <div className="aspect-video w-full max-w-5xl">
            <iframe
              key={item.id}
              src={embed}
              title={item.caption || t("gallery.playVideo")}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full rounded border-0"
            />
          </div>
        )}

        {items.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("common.back")} className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4 sm:block">
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("common.next")} className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4 sm:block">
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      <div className="px-4 py-3 text-center text-white sm:py-4">
        {item.caption && <p className="font-medium">{item.caption}</p>}
        <p className="mt-0.5 text-xs uppercase tracking-wider text-purple-300">{albumName(item.category)}</p>
        {items.length > 1 && <p className="mt-2 text-xs text-white/50 sm:hidden">{t("gallery.swipe")}</p>}
      </div>
    </div>
  );
}
