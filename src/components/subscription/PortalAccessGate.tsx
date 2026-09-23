import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Sparkles, Clock, AlertTriangle, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Full-page portal gate. Shows a blurred preview of `children` and a
 * dominant "Unlock Portal Access" hero if the user has no active
 * subscription. Use at the top of ParentDashboard / StudentDashboard.
 */
export default function PortalAccessGate({
  children,
  portalName = "portal",
}: { children: ReactNode; portalName?: string }) {
  const sub = useSubscription();
  if (sub.loading) return <div className="min-h-[60vh] grid place-items-center"><div className="animate-pulse text-muted-foreground">Checking access…</div></div>;
  if (sub.isActive) return <>{children}</>;

  const pending = sub.status === "pending";
  const expired = sub.status === "expired";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none select-none filter blur-[10px] opacity-40" aria-hidden>
        {children}
      </div>

      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-gradient-to-br from-slate-900/60 via-teal-900/40 to-blue-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl my-8">
          <Card className="p-8 text-center border-2 border-teal-500/40 shadow-2xl bg-background">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-blue-700 flex items-center justify-center mb-4">
              {pending ? <Clock className="w-10 h-10 text-white" /> : expired ? <AlertTriangle className="w-10 h-10 text-white" /> : <Lock className="w-10 h-10 text-white" />}
            </div>

            <Badge className="bg-amber-100 text-amber-700 mb-3">Demo Subscription Gate</Badge>
            <h1 className="font-display text-3xl font-bold mb-2">
              {pending ? "Payment verification in progress" : expired ? "Your access has expired" : `Unlock the ${portalName} portal`}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {pending
                ? "Your bank transfer is being verified. Access will activate automatically once approved."
                : expired
                ? "Renew your subscription to restore full access to timetables, results, materials and messaging."
                : "Subscribe to give your family full access to timetables, lesson plans, exam results, attendance, report cards and direct teacher messaging."}
            </p>

            {!pending && (
              <>
                <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto mb-5 text-left">
                  <PlanPreview name="Monthly Access" price="$10" period="/ month" />
                  <PlanPreview name="Term Access" price="$25" period="/ term" recommended />
                </div>
                <Button asChild size="lg" className="bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90">
                  <Link to="/portal/parent/subscribe">
                    <Sparkles className="w-5 h-5 mr-2" />
                    {expired ? "Renew Subscription" : "View Plans & Subscribe"}
                  </Link>
                </Button>
                <div className="mt-4 text-xs text-muted-foreground">
                  Already paid?{" "}
                  <Link to="/portal/parent/payments" className="underline">Check payment status</Link>
                  {" · "}
                  Or <a className="underline" href="mailto:info@mavingtech.com">contact admin</a>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function PlanPreview({ name, price, period, recommended }: any) {
  return (
    <div className={`rounded-lg border p-3 ${recommended ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/20" : ""}`}>
      <div className="flex items-center gap-1 text-xs">
        {recommended && <Crown className="w-3 h-3 text-teal-600" />}
        <span className="font-medium">{name}</span>
      </div>
      <div className="mt-1"><span className="text-2xl font-bold">{price}</span><span className="text-xs text-muted-foreground">{period}</span></div>
    </div>
  );
}
