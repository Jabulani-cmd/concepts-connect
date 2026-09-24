// Demo-mode email dialog. In production this would hand off to a real
// edge function (Resend/SendGrid). For now it shows a realistic compose UI,
// simulates a successful send via toast, and offers a `mailto:` fallback
// that opens the user's default mail client pre-filled with the document
// summary. The full branded HTML document is also downloaded as a fallback
// attachment so the user can attach it manually if they use mailto.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, ExternalLink, Loader2 } from "lucide-react";
import { downloadHtmlDocument } from "@/lib/finance/print";
import { SCHOOL_ADDRESS, SCHOOL_EMAIL, SCHOOL_PHONE } from "@/lib/school";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-built branded HTML of the document to "attach". */
  html: string;
  /** File-safe name (no extension) used for attachment download. */
  filename: string;
  /** Default subject line. */
  defaultSubject: string;
  /** Optional default recipient. */
  defaultTo?: string;
  /** Document label, e.g. "Invoice", "Receipt", "Statement". */
  documentLabel?: string;
}

export default function EmailDocumentDialog({
  open,
  onOpenChange,
  html,
  filename,
  defaultSubject,
  defaultTo,
  documentLabel = "document",
}: Props) {
  const { toast } = useToast();
  const [to, setTo] = useState(defaultTo || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(
    `Dear recipient,\n\nPlease find attached your ${documentLabel} from MavingTech Business Solutions.\n\nFor any queries please contact the bursar's office.\n\nKind regards,\nBursar's Office\n${SCHOOL_ADDRESS}\nTel: ${SCHOOL_PHONE} | Email: ${SCHOOL_EMAIL}`,
  );
  const [sending, setSending] = useState(false);

  const handleSimulatedSend = async () => {
    if (!to.trim() || !/^\S+@\S+\.\S+$/.test(to.trim())) {
      toast({ title: "Recipient required", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    setSending(true);
    // Simulate network latency to look realistic for demo
    await new Promise((r) => setTimeout(r, 900));
    setSending(false);
    onOpenChange(false);
    toast({
      title: "Email sent (demo)",
      description: `${documentLabel} has been emailed to ${to}.`,
    });
  };

  const handleMailto = () => {
    if (!to.trim()) {
      toast({ title: "Recipient required", description: "Enter an email address first.", variant: "destructive" });
      return;
    }
    // Download the branded document so the user can attach it.
    downloadHtmlDocument(html, filename);
    const params = new URLSearchParams({
      subject,
      body: `${message}\n\n(The branded ${documentLabel} has been downloaded — please attach the file "${filename}.html" to this email.)`,
    });
    if (cc.trim()) params.set("cc", cc.trim());
    const href = `mailto:${encodeURIComponent(to.trim())}?${params.toString().replace(/\+/g, "%20")}`;
    window.location.href = href;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" /> Email {documentLabel}
          </DialogTitle>
          <DialogDescription>
            Send this {documentLabel} as a branded MavingTech document. Demo mode simulates delivery — use "Open mail client" to send through your installed email app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" type="email" placeholder="parent@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-cc">CC <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="email-cc" type="email" placeholder="bursar@mavingtech.com" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-subject">Subject</Label>
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-body">Message</Label>
            <Textarea id="email-body" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <strong>Demo mode:</strong> No real email is sent. In production this calls a backend function (e.g. Resend) to email the recipient with the branded {documentLabel} attached.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleMailto}>
            <ExternalLink className="mr-1 h-4 w-4" /> Open mail client
          </Button>
          <Button onClick={handleSimulatedSend} disabled={sending} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
