import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Clock, Users, CalendarDays, Sparkles, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

interface LinkedPerson {
  id: string;
  name: string;
  detail?: string;
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function AccessStatusPanel({ className = "" }: { className?: string }) {
  const { user, role } = useAuth();
  const sub = useSubscription();
  const [linked, setLinked] = useState<LinkedPerson[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        if (role === "parent") {
          const { data: links } = await supabase
            .from("parent_students")
            .select("student_id")
            .eq("parent_id", user.id);
          const studentIds = (links || []).map((l) => l.student_id).filter(Boolean);
          if (studentIds.length === 0) {
            if (!cancelled) setLinked([]);
          } else {
            const { data: students } = await supabase
              .from("students")
              .select("id, full_name, admission_number, form, stream")
              .in("id", studentIds);
            if (!cancelled) {
              setLinked(
                (students || []).map((s) => ({
                  id: s.id,
                  name: s.full_name || "Student",
                  detail: [s.admission_number, s.form, s.stream].filter(Boolean).join(" · "),
                })),
              );
            }
          }
        } else if (role === "student") {
          const { data: studentRow } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          const ids = [user.id];
          if (studentRow?.id) ids.push(studentRow.id);
          const { data: links } = await supabase
            .from("parent_students")
            .select("parent_id")
            .in("student_id", ids);
          const parentIds = Array.from(new Set((links || []).map((l) => l.parent_id).filter(Boolean)));
          if (parentIds.length === 0) {
            if (!cancelled) setLinked([]);
          } else {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, full_name, email")
              .in("user_id", parentIds);
            if (!cancelled) {
              setLinked(
                parentIds.map((pid) => {
                  const p = (profiles || []).find((x) => x.user_id === pid);
                  return {
                    id: pid,
                    name: p?.full_name || "Parent / Guardian",
                    detail: p?.email || undefined,
                  };
                }),
              );
            }
          }
        }
      } finally {
        if (!cancelled) setLoadingLinked(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const isParent = role === "parent";
  const isStudent = role === "student";
  if (!isParent && !isStudent) return null;

  const activeGrants = (sub.grants || []).filter((g) => {
    const end = g.access_end ? new Date(g.access_end) : null;
    return g.is_active && (!end || end > new Date());
  });

  const statusColor =
    sub.status === "active" || sub.status === "complimentary"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : sub.status === "pending"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : sub.status === "expired"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : "bg-muted text-muted-foreground border-border";

  const StatusIcon = sub.isActive ? ShieldCheck : sub.status === "pending" ? Clock : ShieldAlert;

  const statusLabel =
    sub.status === "active"
      ? "Active"
      : sub.status === "complimentary"
      ? "Complimentary"
      : sub.status === "pending"
      ? "Pending verification"
      : sub.status === "expired"
      ? "Expired"
      : sub.status === "suspended"
      ? "Suspended"
      : "No subscription";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="overflow-hidden border-2 border-primary/15 bg-gradient-to-br from-background to-muted/30">
        <div className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${statusColor}`}>
                <StatusIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold leading-tight">Portal Access</h3>
                <p className="text-xs text-muted-foreground">
                  Subscription &amp; access overview
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`text-xs ${statusColor}`}>
              {statusLabel}
            </Badge>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border bg-card/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Plan</p>
              <p className="text-sm font-semibold mt-0.5 truncate">{sub.plan || "—"}</p>
            </div>
            <div className="rounded-lg border bg-card/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Expires</p>
              <p className="text-sm font-semibold mt-0.5">{fmtDate(sub.expiresAt)}</p>
            </div>
            <div className="rounded-lg border bg-card/50 p-3 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Days left</p>
              <p
                className={`text-sm font-semibold mt-0.5 ${
                  sub.daysRemaining > 7
                    ? "text-emerald-600 dark:text-emerald-400"
                    : sub.daysRemaining > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
                }`}
              >
                {sub.expiresAt ? `${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"}` : "—"}
              </p>
            </div>
          </div>

          {/* Access grants */}
          {activeGrants.length > 0 && (
            <div className="rounded-lg border bg-card/50 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <CalendarDays className="h-3.5 w-3.5" />
                Active access grants
              </div>
              <ul className="space-y-1">
                {activeGrants.slice(0, 3).map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="capitalize font-medium">
                      {(g.grant_type || "grant").replace("_", " ")}
                      {g.reason ? <span className="text-muted-foreground"> · {g.reason}</span> : null}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      until {fmtDate(g.access_end ? new Date(g.access_end) : null)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Linked people */}
          <div className="rounded-lg border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isParent ? <Users className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {isParent ? "Linked children" : "Linked parents / guardians"}
            </div>
            {loadingLinked ? (
              <div className="h-10 rounded bg-muted/40 animate-pulse" />
            ) : linked.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {isParent
                  ? "No children linked yet. Use the child linking form to connect your child's record."
                  : "No parent or guardian linked to your account yet."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {linked.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.detail && <p className="text-muted-foreground truncate">{p.detail}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Linked</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* CTA for parents only */}
          {isParent && !sub.isActive && sub.status !== "pending" && (
            <Button
              asChild
              size="sm"
              className="w-full bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90"
            >
              <Link to="/portal/parent/subscribe">
                <Sparkles className="h-4 w-4 mr-2" />
                {sub.status === "expired" ? "Renew subscription" : "View plans"}
              </Link>
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
