import { describe, it, expect } from "vitest";
import { MEDIA_SLOTS } from "@/lib/siteMedia";
import { mediaStoragePath } from "@/lib/mediaUpload";

describe("website pictures the admin can replace", () => {
  it("has one slot per picture, each with a built-in picture to fall back on", () => {
    const keys = MEDIA_SLOTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(MEDIA_SLOTS.every((s) => s.fallback && s.label && s.page)).toBe(true);
  });

  it("keeps pictures uploaded before under their old names", () => {
    expect(MEDIA_SLOTS.map((s) => s.key)).toEqual(expect.arrayContaining(["principal_photo", "achievements_image"]));
  });

  it("lets page banners, and only banners, be videos", () => {
    for (const s of MEDIA_SLOTS) expect(!!s.allowVideo).toBe(s.shape === "banner");
  });

  it("only deletes files that live in the school's media storage", () => {
    expect(mediaStoragePath("https://x.supabase.co/storage/v1/object/public/school-media/site-images/a%20b.jpg")).toBe("site-images/a b.jpg");
    expect(mediaStoragePath("https://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(mediaStoragePath("/assets/hero-students-2-abc.jpg")).toBeNull();
  });
});
