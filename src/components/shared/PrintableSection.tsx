// Wraps any block of portal UI with a header bar that exposes
// View / Print / Download actions. The captured DOM is wrapped in a fully
// branded HTML document (school logo + name + motto in the header) before
// being opened, printed, or downloaded.
import { ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Printer, Download } from "lucide-react";
import { buildBrandedHtml, safeFileName } from "@/lib/print/printSection";
import { openPrintWindow, openViewWindow, downloadHtmlDocument } from "@/lib/finance/print";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  fileName?: string;
  className?: string;
  /** Render without an outer Card wrapper (just the action bar + body). */
  bare?: boolean;
  /** Hide the top View / Print / Download action bar. */
  hideActions?: boolean;
}

export default function PrintableSection({ title, subtitle, children, fileName, className, bare, hideActions }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const buildHtml = () => {
    const body = ref.current?.innerHTML || "";
    return buildBrandedHtml({ title, subtitle, bodyHtml: body });
  };

  const fname = safeFileName(fileName || title);

  const actions = hideActions ? null : (
    <div className="inline-flex items-center gap-1 print:hidden" data-print-hide>
      <Button variant="outline" size="sm" onClick={() => openViewWindow(buildHtml())} title="View">
        <Eye className="mr-1 h-4 w-4" /> View
      </Button>
      <Button variant="outline" size="sm" onClick={() => openPrintWindow(buildHtml())} title="Print">
        <Printer className="mr-1 h-4 w-4" /> Print
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadHtmlDocument(buildHtml(), fname)} title="Download">
        <Download className="mr-1 h-4 w-4" /> Download
      </Button>
    </div>
  );

  if (bare) {
    return (
      <div className={className}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
        <div ref={ref}>{children}</div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        <div ref={ref}>{children}</div>
      </CardContent>
    </Card>
  );
}
