import { describe, it, expect } from "vitest";
import { galleryEmbedUrl, galleryKind, galleryThumbnail, isVideoLink, youTubeId } from "@/lib/gallery";

describe("school gallery", () => {
  const photo = "https://abc.supabase.co/storage/v1/object/public/school-media/gallery/1.jpg";
  const clip = "https://abc.supabase.co/storage/v1/object/public/school-media/gallery/2.mp4";

  it("tells photos, video files and video links apart", () => {
    expect(galleryKind(photo)).toBe("image");
    expect(galleryKind(clip)).toBe("video");
    expect(galleryKind("https://example.com/clip.MOV?x=1")).toBe("video");
    expect(galleryKind("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(galleryKind("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("youtube");
    expect(galleryKind("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("youtube");
    expect(galleryKind("https://vimeo.com/76979871")).toBe("vimeo");
  });

  it("finds a picture for the grid and a player for linked videos", () => {
    expect(galleryThumbnail(photo)).toBe(photo);
    expect(galleryThumbnail(clip)).toBeNull();
    expect(galleryThumbnail("https://youtu.be/dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(galleryEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(galleryEmbedUrl("https://vimeo.com/76979871")).toContain("player.vimeo.com/video/76979871");
    expect(galleryEmbedUrl(photo)).toBeNull();
  });

  it("only accepts YouTube and Vimeo addresses as video links", () => {
    expect(isVideoLink("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isVideoLink("https://example.com/video")).toBe(false);
    expect(youTubeId("https://youtube.com/watch?v=short")).toBeNull();
  });
});
