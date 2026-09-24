import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EM_DASH = "\u2014";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|json|html)$/.test(name) ? [path] : [];
  });
}

describe("app text", () => {
  it("contains no em dashes", () => {
    const offenders = [...files("src"), ...files("supabase/functions"), "index.html"]
      .filter((f) => readFileSync(f, "utf8").includes(EM_DASH));
    expect(offenders).toEqual([]);
  });
});
