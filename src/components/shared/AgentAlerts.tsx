import { useEffect, useState } from "react";
import { Award, CalendarX, TrendingDown, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Note = { id: string; title: string; message: string | null; type: string; created_at: string; is_read: boolean };

const STYLE: Record<string, { icon: typeof Award; box: string; iconClass: string }> = {
  child_absent: { icon: CalendarX, box: "border-amber-300 bg-amber-50 dark:bg-amber-950/30", iconClass: "text-amber-600" },
  child_support: { icon: TrendingDown, box: "border-red-200 bg-red-50 dark:bg-red-950/30", iconClass: "text-red-600" },
  progress_support: { icon: TrendingDown, box: "border-red-200 bg-red-50 dark:bg-red-950/30", iconClass: "text-red-600" },
  child_excellent: { icon: Award, box: "border-green-200 bg-green-50 dark:bg-green-950/30", iconClass: "text-green-600" },
  progress_praise: { icon: Award, box: "border-green-200 bg-green-50 dark:bg-green-950/30", iconClass: "text-green-600" },
};

const TYPES = {
  parent: ["child_absent", "child_support", "child_excellent"],
  student: ["progress_support", "progress_praise"],
};

/**
 * Alerts from the school agent, shown at the top of the parent and student portals:
 * absences, marks that need attention, and praise for excellent work.
 */
export default function AgentAlerts({ audience }: { audience: "parent" | "student" }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - (audience === "parent" ? 14 : 30) * 86400000).toISOString();
    const load = () =>
      supabase.from("notifications").select("id, title, message, type, created_at, is_read")
        .eq("user_id", user.id).in("type", TYPES[audience]).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(8)
        .then(({ data }) => setNotes((data as Note[] | null) ?? []));
    load();
    const ch = supabase.channel(`agent-alerts-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, audience]);

  // A learner sees only their latest note; a parent sees recent notes about all their children.
  const shown = (audience === "student" ? notes.slice(0, 1) : notes).filter((n) => audience === "student" || !n.is_read || Date.now() - new Date(n.created_at).getTime() < 3 * 86400000);
  if (!shown.length) return null;

  const dismiss = async (id: string) => {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  return (
    <Card>
      {audience === "parent" && (
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Updates from the school</CardTitle></CardHeader>
      )}
      <CardContent className={cn("space-y-2", audience === "student" && "pt-4")}>
        {shown.map((n) => {
          const st = STYLE[n.type] ?? STYLE.child_absent;
          return (
            <div key={n.id} className={cn("flex items-start gap-3 rounded-lg border p-3", st.box)}>
              <st.icon className={cn("mt-0.5 h-5 w-5 shrink-0", st.iconClass)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.message && <p className="text-sm text-foreground/80">{n.message}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
              </div>
              <button type="button" onClick={() => dismiss(n.id)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:bg-background/60"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
