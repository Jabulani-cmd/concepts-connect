import { useEffect, useState, useSyncExternalStore } from "react";
import { isIosSafari, pwaStore } from "@/lib/pwa";

/** Install/update state plus whether this device can install the app right now. */
export function usePwa() {
  const state = useSyncExternalStore(pwaStore.subscribe, pwaStore.get, pwaStore.get);
  const ios = isIosSafari();
  return { ...state, ios, canInstall: !state.installed && (!!state.installEvent || ios) };
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
