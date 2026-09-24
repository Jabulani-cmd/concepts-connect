import { useTranslation } from "react-i18next";
import { PlusSquare, Share } from "lucide-react";

/** How to add the app on iPhone/iPad, where Safari has no install button. */
export default function IosInstallSteps() {
  const { t } = useTranslation();
  return (
    <ol className="space-y-2 text-sm">
      <li className="flex items-center gap-2">
        <Share className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t("pwa.iosStep1")}
      </li>
      <li className="flex items-center gap-2">
        <PlusSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t("pwa.iosStep2")}
      </li>
      <li className="pl-6 text-muted-foreground">{t("pwa.iosStep3")}</li>
    </ol>
  );
}
