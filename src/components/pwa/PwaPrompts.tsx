import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promptInstall, updateNow } from "@/lib/pwa";
import IosInstallSteps from "./IosInstallSteps";
import { useOnline, usePwa } from "./usePwa";
const appIcon = "/icons/icon-192.png";

const DISMISS_KEY = "mavingtech.installDismissed";
const ASK_AGAIN_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/**
 * App-wide notices for the installable app: an install offer (asked again two
 * weeks after "Not now"), a "new version" notice and an offline bar.
 */
export default function PwaPrompts() {
  const { t } = useTranslation();
  const { canInstall, installEvent, ios, updateReady } = usePwa();
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(dismissedRecently);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Still hidden for this visit.
    }
  };

  const showInstall = ready && canInstall && !dismissed && !updateReady;

  return (
    <>
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-medium text-black">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t("pwa.offline")}
        </div>
      )}

      {(showInstall || updateReady) && (
        <div
          role="dialog"
          aria-label={updateReady ? t("pwa.updateReady") : t("pwa.installTitle")}
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl sm:bottom-5"
        >
          {updateReady ? (
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="flex-1 text-sm">{t("pwa.updateReady")}</p>
              <Button size="sm" onClick={updateNow}>{t("pwa.update")}</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <img src={appIcon} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-border" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{t("pwa.installTitle")}</p>
                  <button type="button" onClick={dismiss} aria-label={t("common.close")} className="-mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {installEvent ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t("pwa.installBody")}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void promptInstall()}>{t("pwa.install")}</Button>
                      <Button size="sm" variant="ghost" onClick={dismiss}>{t("pwa.notNow")}</Button>
                    </div>
                  </>
                ) : ios ? (
                  <>
                    <IosInstallSteps />
                    <Button size="sm" variant="outline" onClick={dismiss}>{t("pwa.gotIt")}</Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
