import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { promptInstall } from "@/lib/pwa";
import IosInstallSteps from "./IosInstallSteps";
import { usePwa } from "./usePwa";

/** "Install the app" link; hidden when the app is installed or the device can't install it. */
export default function InstallAppButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { canInstall, installEvent } = usePwa();
  const [showIos, setShowIos] = useState(false);
  if (!canInstall) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (installEvent ? void promptInstall() : setShowIos(true))}
        className={className ?? "inline-flex items-center gap-2 transition-colors hover:text-primary"}
      >
        <Download className="h-4 w-4" aria-hidden="true" /> {t("pwa.installLink")}
      </button>
      <Dialog open={showIos} onOpenChange={setShowIos}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("pwa.iosTitle")}</DialogTitle>
          </DialogHeader>
          <IosInstallSteps />
        </DialogContent>
      </Dialog>
    </>
  );
}
