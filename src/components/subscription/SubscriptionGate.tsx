import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Sparkles, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
  /** Feature label shown in the overlay (e.g. "Timetable") */
  feature?: string;
  /** If true, hide content completely instead of blur. */
  hard?: boolean;
  /** Optional preview shown blurred behind the lock. If omitted, children are blurred. */
  preview?: ReactNode;
}

export default function SubscriptionGate({ children, feature = "this feature", hard = false, preview }: Props) {
  const sub = useSubscription();
  const { role } = useAuth();

  const isStudent = role === "student";
  const renewExpired = sub.status === "expired";
  const pending = sub.status === "pending";

  const lockCard = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={hard ? "flex items-center justify-center p-4 min-h-[50vh]" : "absolute inset-0 flex items-center justify-center p-4"}
    >
      <Card className="w-full max-w-md p-6 text-center border-2 border-primary/40 shadow-xl bg-background/95 backdrop-blur">
        <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-3">
          {pending ? <Clock className="w-7 h-7 text-white" /> : renewExpired ? <AlertTriangle className="w-7 h-7 text-white" /> : <Lock className="w-7 h-7 text-white" />}
        </div>
        <h3 className="font-display text-xl font-bold mb-1">
          {pending
            ? "Payment verification in progress"
            : isStudent
            ? "Subscription required"
            : renewExpired
            ? "Your access has expired"
            : `Subscribe to access ${feature}`}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {pending
            ? "Your bank transfer is being verified by the school. We'll unlock the portal as soon as it's approved."
            : isStudent
            ? `Your parent or guardian must subscribe for you to access ${feature}. Please ask them to subscribe via the parent portal.`
            : renewExpired
            ? `Your subscription expired. Renew now to restore access to ${feature} and all premium features.`
            : `Unlock full access to ${feature}, the timetable, results, materials, messaging, and more.`}
        </p>
        {!pending && !isStudent && (
          <Button asChild className="bg-gradient-to-r from-purple-600 to-purple-700 hover:opacity-90">
            <Link to="/portal/parent/subscribe">
              <Sparkles className="w-4 h-4 mr-2" />
              {renewExpired ? "Renew Now" : "View Plans"}
            </Link>
          </Button>
        )}
      </Card>
    </motion.div>
  );

  if (sub.loading) {
    return hard ? (
      <div className="flex items-center justify-center p-4 min-h-[50vh]">
        <div className="animate-pulse h-40 w-full max-w-md rounded-xl bg-muted/40" />
      </div>
    ) : (
      <div className="animate-pulse h-40 rounded-xl bg-muted/40" />
    );
  }
  if (sub.isActive) return <>{children}</>;

  if (hard) return lockCard;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[6px] opacity-60" aria-hidden>
        {preview ?? children}
      </div>
      {lockCard}
    </div>
  );
}

/** Slim expiry banner shown above gated content when within 7 days. */
export function ExpiryBanner() {
  const sub = useSubscription();
  if (!sub.isActive || sub.daysRemaining > 7 || sub.daysRemaining <= 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-4 py-2 flex items-center justify-between mb-4">
      <div className="text-sm flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span>
          Your portal access expires in <strong>{sub.daysRemaining} day{sub.daysRemaining === 1 ? "" : "s"}</strong>.
        </span>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/portal/parent/subscribe">Renew</Link>
      </Button>
    </div>
  );
}
