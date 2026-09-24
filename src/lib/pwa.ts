/**
 * Installable app (PWA) support: registers the service worker, keeps the
 * browser's install offer so the app can show its own "Install" button, and
 * tells the UI when a new version is ready.
 */

/** Chrome/Edge/Android fire this when the site can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type State = { installEvent: BeforeInstallPromptEvent | null; updateReady: boolean; installed: boolean };

let state: State = { installEvent: null, updateReady: false, installed: false };
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const pwaStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Running as an installed app (home-screen icon) rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

/** iPhone/iPad Safari: no install prompt, users add it from the Share menu. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

/**
 * Service workers are skipped inside iframes and on Lovable preview hosts, so the
 * editor preview always shows the latest code.
 */
export function canUseServiceWorker(host = window.location.hostname, inFrame = window.self !== window.top): boolean {
  if (!("serviceWorker" in navigator) || inFrame) return false;
  return !/(^|\.)lovableproject\.com$/.test(host) && !/^id-preview--/.test(host) && !/^preview--/.test(host);
}

/** Shows the browser's install dialog. Resolves true if the user installed the app. */
export async function promptInstall(): Promise<boolean> {
  const e = state.installEvent;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  set({ installEvent: null, installed: outcome === "accepted" });
  return outcome === "accepted";
}

const RELOAD_KEY = "mavingtech.reloadedForUpdate";

/**
 * A screen's file could not be loaded: this copy of the app is older than the
 * published one. Fetch the new version and reload, at most once a minute so a
 * real outage cannot cause a reload loop. Returns false if it already tried.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last && Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage, still try once.
  }
  const reload = () => window.location.reload();
  navigator.serviceWorker?.getRegistration()
    .then((r) => r?.update())
    .catch(() => {})
    .finally(reload);
  return true;
}

/** Switches to the new version and reloads the page. */
export function updateNow() {
  void applyUpdate?.(true);
}

export function initPwa() {
  if (typeof window === "undefined") return;

  set({ installed: isStandalone() });
  // Vite reports screen files that fail to load; recover by loading the new version.
  window.addEventListener("vite:preloadError", (e) => {
    if (reloadForNewVersion()) e.preventDefault();
  });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // Show our own Install button instead of the browser's mini-bar.
    set({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ installEvent: null, installed: true }));

  if (!import.meta.env.PROD) return;
  if (!canUseServiceWorker()) {
    // Remove any worker left over from an earlier visit so previews never go stale.
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      applyUpdate = registerSW({
        onNeedRefresh: () => set({ updateReady: true }),
        onRegisteredSW: (_url, registration) => {
          // Look for a new version whenever the app comes back to the foreground.
          if (!registration) return;
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") registration.update().catch(() => {});
          });
        },
      });
    })
    .catch(() => {
      // The app still works without offline support.
    });
}
