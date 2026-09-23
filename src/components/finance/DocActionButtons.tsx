import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, Printer, Download, Mail } from "lucide-react";
import type { DocActions } from "@/lib/finance/documentActions";
import EmailDocumentDialog from "./EmailDocumentDialog";

interface Props {
  actions: DocActions | (() => Promise<DocActions> | DocActions);
  size?: "sm" | "icon";
  labels?: boolean;
  /** Enable the Email button (uses the document HTML to compose an email). */
  email?: {
    documentLabel: string; // "Invoice", "Receipt", "Statement", "Report"
    filename: string;      // base file name (no extension)
    subject: string;       // default subject line
    defaultTo?: string;    // optional pre-filled recipient
  };
}

async function resolve(a: Props["actions"]): Promise<DocActions> {
  if (typeof a === "function") return await a();
  return a;
}

export default function DocActionButtons({ actions, size = "icon", labels = false, email }: Props) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailHtml, setEmailHtml] = useState("");

  const handle = async (key: "view" | "print" | "download") => {
    const resolved = await resolve(actions);
    resolved[key]();
  };

  const openEmail = async () => {
    const resolved = await resolve(actions);
    setEmailHtml(resolved.html());
    setEmailOpen(true);
  };

  const emailBtn = email && (
    labels ? (
      <Button variant="outline" size="sm" onClick={openEmail}>
        <Mail className="mr-1 h-4 w-4" /> Email
      </Button>
    ) : (
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEmail} title="Email">
        <Mail className="h-3.5 w-3.5" />
      </Button>
    )
  );

  const dialog = email && (
    <EmailDocumentDialog
      open={emailOpen}
      onOpenChange={setEmailOpen}
      html={emailHtml}
      filename={email.filename}
      defaultSubject={email.subject}
      defaultTo={email.defaultTo}
      documentLabel={email.documentLabel}
    />
  );

  if (labels) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handle("view")}>
            <Eye className="mr-1 h-4 w-4" /> View
          </Button>
          <Button variant="outline" size="sm" onClick={() => handle("print")}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => handle("download")}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          {emailBtn}
        </div>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handle("view")} title="View">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handle("print")} title="Print">
          <Printer className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handle("download")} title="Download">
          <Download className="h-3.5 w-3.5" />
        </Button>
        {emailBtn}
      </div>
      {dialog}
    </>
  );
}
