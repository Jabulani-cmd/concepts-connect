import { describe, it, expect } from "vitest";
import { downloadName } from "@/lib/download";

describe("document downloads", () => {
  it("names the saved file after the document title, keeping its type", () => {
    expect(downloadName("School Fees: Term 1 2026", "https://x.supabase.co/storage/v1/object/public/school-media/downloads/1727.pdf")).toBe("School-Fees-Term-1-2026.pdf");
    expect(downloadName("Uniform list", "https://x/y/list.docx?token=1")).toBe("Uniform-list.docx");
    expect(downloadName("", "https://x/y/file")).toBe("document.pdf");
  });
});
