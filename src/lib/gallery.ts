/**
 * The school gallery: photos and videos kept in the `gallery_images` table.
 * A row's `image_url` holds the photo, the uploaded video file, or a YouTube or
 * Vimeo link; what kind of item it is follows from that address.
 */

export type GalleryKind = "image" | "video" | "youtube" | "vimeo";

export interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

/** Albums a photo or video can be filed under. */
export const GALLERY_CATEGORIES = [
  { value: "general", label: "School Life" },
  { value: "academics", label: "Academics" },
  { value: "sports", label: "Sports" },
  { value: "culture", label: "Culture & Arts" },
  { value: "events", label: "Events & Celebrations" },
  { value: "prize-giving", label: "Prize-Giving" },
  { value: "boarding", label: "Boarding" },
  { value: "facilities", label: "Facilities" },
] as const;

export function categoryLabel(value: string | null | undefined): string {
  return GALLERY_CATEGORIES.find((c) => c.value === (value || "general"))?.label ?? (value || "School Life");
}

/** Largest video file that can be uploaded; longer videos go on YouTube and are linked. */
export const MAX_VIDEO_MB = 50;

const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv|ogg)(\?|#|$)/i;

export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}

export function galleryKind(url: string): GalleryKind {
  if (youTubeId(url)) return "youtube";
  if (vimeoId(url)) return "vimeo";
  if (VIDEO_FILE.test(url)) return "video";
  return "image";
}

export const isVideo = (url: string) => galleryKind(url) !== "image";

/** A still picture for the grid, or null when the video itself shows its first frame. */
export function galleryThumbnail(url: string): string | null {
  const kind = galleryKind(url);
  if (kind === "image") return url;
  if (kind === "youtube") return `https://i.ytimg.com/vi/${youTubeId(url)}/hqdefault.jpg`;
  return null;
}

/** The player address for a linked video. */
export function galleryEmbedUrl(url: string): string | null {
  const yt = youTubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}?autoplay=1`;
  return null;
}

/** True for a YouTube or Vimeo address the gallery can play. */
export const isVideoLink = (url: string) => !!(youTubeId(url) || vimeoId(url));

/**
 * Shrinks a large photo before upload (longest side 1920px, JPEG), so the gallery
 * loads quickly on phones. Small photos and anything that cannot be read are kept as they are.
 */
export async function shrinkPhoto(file: File, maxSide = 1920): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
