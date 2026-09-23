import { supabase } from "@/integrations/supabase/client";

/**
 * Receipts and student submissions live in the private "school-private" bucket.
 * Database rows store a reference ("storage://school-private/<path>") instead of a
 * public link; opening a file creates a signed link that expires after a minute.
 * Older rows may still hold plain public URLs, which are opened as they are.
 */
export const PRIVATE_BUCKET = "school-private";
const PREFIX = `storage://${PRIVATE_BUCKET}/`;
const SIGNED_LINK_SECONDS = 60;

export const privateFileRef = (path: string) => `${PREFIX}${path}`;
export const isPrivateFileRef = (ref: string | null | undefined): ref is string => !!ref && ref.startsWith(PREFIX);

/** Uploads to the private bucket and returns the reference to store, or throws. */
export async function uploadPrivateFile(path: string, file: Blob, contentType?: string, upsert = false): Promise<string> {
  const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { contentType, upsert });
  if (error) throw error;
  return privateFileRef(path);
}

/** A link the browser can open: a fresh signed link for private files, the URL itself otherwise. */
export async function resolveFileUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (!isPrivateFileRef(ref)) return ref;
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(ref.slice(PREFIX.length), SIGNED_LINK_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Opens a stored file in a new tab. The tab is opened straight away (so pop-up
 * blockers allow it) and pointed at the signed link once it is ready.
 */
export async function openStoredFile(ref: string | null | undefined): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await resolveFileUrl(ref);
    if (!url) throw new Error("No file to open");
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    throw e;
  }
}
