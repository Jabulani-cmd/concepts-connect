/** A file name for a document, from its title and the extension in its address. */
export function downloadName(title: string, url: string): string {
  const fromUrl = decodeURIComponent(url.split("?")[0].split("/").pop() || "");
  const ext = fromUrl.includes(".") ? fromUrl.split(".").pop() : "pdf";
  return `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "document"}.${ext}`;
}

/**
 * Saves a document on the device (phones included). If the browser will not
 * download it, the document opens in a new tab instead.
 */
export async function downloadFile(url: string, title: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = downloadName(title, url);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
