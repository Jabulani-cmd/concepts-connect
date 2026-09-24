import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "@/i18n";

type State = { failed: boolean };

/** Shows a way back instead of a blank white screen when a page crashes. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page failed to render", error, info.componentStack);
  }

  private reload = async () => {
    // Drop saved screen files in case one of them is damaged, then start fresh.
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n === "app-files").map((n) => caches.delete(n)));
    } catch {
      // Cache storage unavailable: a plain reload still helps.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl border border-border" />
        <h1 className="font-heading text-xl font-bold text-foreground">{i18n.t("pwa.errorTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{i18n.t("pwa.errorBody")}</p>
        <div className="flex gap-2">
          <button type="button" onClick={this.reload} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {i18n.t("pwa.reload")}
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            {i18n.t("pwa.home")}
          </a>
        </div>
      </div>
    );
  }
}
