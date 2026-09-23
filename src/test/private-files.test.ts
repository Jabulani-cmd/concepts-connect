import { describe, it, expect, vi } from "vitest";

const createSignedUrl = vi.fn();
const upload = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: (bucket: string) => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a), upload: (...a: unknown[]) => upload(bucket, ...a) }) } },
}));

import { resolveFileUrl, uploadPrivateFile, isPrivateFileRef } from "@/lib/privateFiles";

describe("private files", () => {
  it("stores uploads in the private bucket and returns a reference, not a public link", async () => {
    upload.mockResolvedValue({ error: null });
    const ref = await uploadPrivateFile("receipts/abc.pdf", new Blob(["x"]), "application/pdf", true);
    expect(upload).toHaveBeenCalledWith("school-private", "receipts/abc.pdf", expect.any(Blob), { contentType: "application/pdf", upsert: true });
    expect(ref).toBe("storage://school-private/receipts/abc.pdf");
    expect(isPrivateFileRef(ref)).toBe(true);
  });

  it("opens private files through a short-lived signed link", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/abc?token=1" }, error: null });
    await expect(resolveFileUrl("storage://school-private/submissions/s1/essay.pdf")).resolves.toBe("https://signed.example/abc?token=1");
    expect(createSignedUrl).toHaveBeenCalledWith("school-private", "submissions/s1/essay.pdf", 60);
  });

  it("passes older public links through unchanged", async () => {
    createSignedUrl.mockClear();
    await expect(resolveFileUrl("https://x.supabase.co/storage/v1/object/public/school-media/receipts/R1.pdf")).resolves.toMatch(/^https:/);
    await expect(resolveFileUrl(null)).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
