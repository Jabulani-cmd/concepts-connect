import { describe, it, expect, vi, afterEach } from "vitest";
import { canUseServiceWorker, isIosSafari } from "@/lib/pwa";

const setUA = (ua: string, touch = 0) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true });
};

describe("installable app", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the offline worker on the live site but not in Lovable previews or iframes", () => {
    Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
    expect(canUseServiceWorker("schools-mavingtech.online", false)).toBe(true);
    expect(canUseServiceWorker("schools-mavingtech.online", true)).toBe(false);
    expect(canUseServiceWorker("id-preview--5050c73e.lovable.app", false)).toBe(false);
    expect(canUseServiceWorker("5050c73e.lovableproject.com", false)).toBe(false);
  });

  it("recognises iPhone and iPad Safari, which install from the Share menu", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
    expect(isIosSafari()).toBe(true);
    setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", 5);
    expect(isIosSafari()).toBe(true);
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1");
    expect(isIosSafari()).toBe(false);
    setUA("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36");
    expect(isIosSafari()).toBe(false);
  });
});
