import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { getAlertSettings, saveAlertSettings, type AlertSettings } from "@/lib/agent";

/** Who the school agent alerts, and the marks it uses to decide. */
export default function AgentAlertSettings() {
  const { toast } = useToast();
  const [s, setS] = useState<AlertSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    getAlertSettings().then((v) => (v ? setS(v) : setUnavailable(true)));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      await saveAlertSettings(s);
      toast({ title: "Alert settings saved", description: "The agent uses them from its next run." });
    } catch (e) {
      toast({ title: "Could not save", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><BellRing className="h-5 w-5 text-primary" /> Alerts to families and learners</CardTitle>
        <CardDescription className="max-w-3xl">
          The agent tells parents on the same day when their child is marked absent, every two weeks if their child's marks are below the support mark, and once a
          month when their child is doing very well. Learners get a note in their own portal. Messages are short, factual and never mention discipline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unavailable ? (
          <p className="text-sm text-muted-foreground">These settings appear once the new agent SQL file has been run in the database.</p>
        ) : !s ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.notify_parents} onCheckedChange={(v) => setS({ ...s, notify_parents: v })} /> Alert parents</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.notify_students} onCheckedChange={(v) => setS({ ...s, notify_students: v })} /> Alert learners</label>
            <div className="space-y-1">
              <Label htmlFor="low-mark">Support mark (below)</Label>
              <Input id="low-mark" type="number" min={0} max={100} className="w-24" value={s.low_mark} onChange={(e) => setS({ ...s, low_mark: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="excellent-mark">Excellence mark (from)</Label>
              <Input id="excellent-mark" type="number" min={0} max={100} className="w-24" value={s.excellent_mark} onChange={(e) => setS({ ...s, excellent_mark: Number(e.target.value) })} />
            </div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
