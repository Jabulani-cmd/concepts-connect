import { supabase } from "@/integrations/supabase/client";
import { MAX_VIDEO_MB, shrinkPhoto } from "@/lib/gallery";

/** Public bucket that holds every picture and video shown on the website. */
export const MEDIA_BUCKET = "school-media";

export class MediaTooLargeError extends Error {
  constructor() {
    super(`Videos can be up to ${MAX_VIDEO_MB} MB. Put longer videos on YouTube and add the link instead.`);
  }
}

/**
 * Uploads a photo or video for the website and returns its public address.
 * Photos are resized for phones first; videos over the size limit are refused.
 */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const isVideoFile = file.type.startsWith("video/");
  if (isVideoFile && file.size > MAX_VIDEO_MB * 1024 * 1024) throw new MediaTooLargeError();
  const body = isVideoFile ? file : await shrinkPhoto(file);
  const ext = body.name.split(".").pop()?.toLowerCase() || body.type.split("/")[1] || "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, { cacheControl: "31536000", upsert: false, contentType: body.type || undefined });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Path of a file in the media bucket, from its public address (null for anything else). */
export function mediaStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
}

/** Deletes an uploaded file; addresses outside the bucket (YouTube, built-in pictures) are left alone. */
export async function removeMedia(url: string | null | undefined): Promise<void> {
  const path = url ? mediaStoragePath(url) : null;
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
