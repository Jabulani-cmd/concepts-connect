import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";

type BatchResult = { moved: number; remaining: number; failed: { path: string; error: string }[] };

/**
 * Moves receipts and student submissions that were uploaded before private storage
 * existed out of the public bucket. Runs the move-private-files function in batches.
 */
export default function PrivateFilesMigrationCard() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [moved, setMoved] = useState(0);
  const [failed, setFailed] = useState<BatchResult["failed"]>([]);
  const [done, setDone] = useState(false);

  async function run() {
    setRunning(true);
    setDone(false);
    setFailed([]);
    let total = 0;
    try {
      for (;;) {
        const { data, error } = await supabase.functions.invoke<BatchResult>("move-private-files");
        if (error) throw error;
        if (!data) throw new Error("No response from the server");
        total += data.moved;
        setMoved(total);
        setFailed(data.failed);
        // Stop when everything is moved, or when a batch makes no progress (only failures left).
        if (data.remaining === 0 || data.moved === 0) break;
      }
      setDone(true);
      toast({ title: "Private files moved", description: `${total} file(s) moved to private storage.` });
    } catch (e) {
      toast({ title: "Moving files failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Move receipts and submissions to private storage</CardTitle>
        <CardDescription>
          New receipts and student submissions are already stored privately. Run this once to move files uploaded
          earlier, which can still be opened by anyone who has their link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          {running ? `Moving… ${moved} moved` : "Move files now"}
        </Button>
        {done && <p className="text-sm text-muted-foreground">{moved} file(s) moved. You can run this again at any time; it only moves what is left.</p>}
        {failed.length > 0 && (
          <div className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium text-destructive">{failed.length} file(s) could not be moved:</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {failed.slice(0, 10).map((f) => <li key={f.path}>{f.path}: {f.error}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
