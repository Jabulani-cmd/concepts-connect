import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES, type LangCode } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Language drop-down (English, chiShona, isiNdebele) for the navigation bar of
 * every page. The choice applies across the whole app straight away and is
 * remembered on this device.
 */
export default function LanguageSelect({ className }: Props) {
  const { i18n, t } = useTranslation();
  const current =
    SUPPORTED_LANGUAGES.find((l) => i18n.resolvedLanguage?.startsWith(l.code)) ?? SUPPORTED_LANGUAGES[0];

  const change = (code: LangCode) => {
    if (code === current.code) return;
    i18n.changeLanguage(code);
    try {
      localStorage.setItem("mavingtech.lang", code);
    } catch {
      // Language still changes immediately even if storage is unavailable.
    }
  };

  return (
    // Language names are shown in their own language, so the page translator leaves them alone.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-no-translate="true"
        aria-label={`${t("common.language")}: ${current.label}`}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.short}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[60] min-w-[10rem]" data-no-translate="true">
        {SUPPORTED_LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => change(l.code)}
            className="flex items-center justify-between gap-3"
            aria-current={l.code === current.code ? "true" : undefined}
          >
            <span>{l.label}</span>
            {l.code === current.code && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
