import { lazy, type ComponentType } from "react";
import { reloadForNewVersion } from "@/lib/pwa";

/**
 * React.lazy for route pages. If a page's file is missing because a newer version
 * of the app has been published, the new version is loaded instead of showing a
 * blank screen (the loading spinner stays up while it reloads).
 */
export function lazyPage<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      if (reloadForNewVersion()) return new Promise<never>(() => {});
      throw error;
    }),
  );
}
