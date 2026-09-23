import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions"> & {
  subscription_plans?: Pick<Tables<"subscription_plans">, "name" | "plan_type"> | null;
};
import { useAuth } from "@/contexts/AuthContext";

export type SubStatus = "active" | "expired" | "pending" | "suspended" | "complimentary" | "trial" | "none";

export interface SubscriptionState {
  loading: boolean;
  isActive: boolean;
  status: SubStatus;
  plan: string | null;
  planType: Enums<"subscription_plan_type"> | null;
  expiresAt: Date | null;
  daysRemaining: number;
  subscription: Subscription | null;
  grants: Tables<"access_grants">[];
  refresh: () => Promise<void>;
}

/**
 * Subscription / access gate for the Parent + Student portals.
 *
 * Logic:
 * - Admins / staff always have access.
 * - For a parent: look for their latest non-cancelled subscription.
 * - For a student: if ANY linked parent (or themselves) has an active
 *   subscription or active complimentary grant, access is unlocked.
 */
export function useSubscription(): SubscriptionState {
  const { user, role } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    loading: true,
    isActive: false,
    status: "none",
    plan: null,
    planType: null,
    expiresAt: null,
    daysRemaining: 0,
    subscription: null,
    grants: [],
    refresh: async () => {},
  });

  const load = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Staff bypass
    const staffRoles = ["admin", "supervisor", "hod", "teacher", "registration", "staff"];
    if (role && staffRoles.includes(role)) {
      setState({
        loading: false,
        isActive: true,
        status: "complimentary",
        plan: "Staff Access",
        planType: null,
        expiresAt: null,
        daysRemaining: 9999,
        subscription: null,
        grants: [],
        refresh: load,
      });
      return;
    }

    // For students, also include any linked parents' subscriptions/grants.
    // For parents, also include all linked students so a subscription against
    // the student row unlocks BOTH parents linked to that student.
    const userIds: string[] = [user.id];
    const studentIds: string[] = [];

    if (role === "student") {
      const { data: studentRow } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const studentRowId = studentRow?.id;
      if (studentRowId) studentIds.push(studentRowId);

      const linkIds = [user.id, ...(studentRowId ? [studentRowId] : [])];
      const { data: links } = await supabase
        .from("parent_students")
        .select("parent_id")
        .in("student_id", linkIds);
      for (const l of links || []) {
        if (l?.parent_id && !userIds.includes(l.parent_id)) userIds.push(l.parent_id);
      }
    } else if (role === "parent") {
      const { data: links } = await supabase
        .from("parent_students")
        .select("student_id")
        .eq("parent_id", user.id);
      for (const l of links || []) {
        if (l?.student_id) studentIds.push(l.student_id);
      }
    }

    const orParts: string[] = [];
    userIds.forEach((id) => { orParts.push(`parent_id.eq.${id}`); orParts.push(`student_id.eq.${id}`); });
    studentIds.forEach((id) => { orParts.push(`student_id.eq.${id}`); });
    const orFilter = orParts.join(",");


    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*, subscription_plans(name, plan_type)")
      .or(orFilter)
      .order("access_end", { ascending: false, nullsFirst: false })
      .limit(20);

    const { data: grants } = await supabase
      .from("access_grants")
      .select("*")
      .or(orFilter)
      .eq("is_active", true);

    const now = new Date();
    let activeSub: Subscription | null = null;
    let status: SubStatus = "none";

    if (subs && subs.length) {
      const live = subs.find((s) => {
        const end = s.access_end ? new Date(s.access_end) : null;
        return s.status === "active" && end && end > now;
      });
      if (live) {
        activeSub = live;
        status = "active";
      } else {
        const pending = subs.find((s) => s.status === "pending");
        const expired = subs.find((s) => s.status === "expired" || (s.access_end && new Date(s.access_end) < now));
        if (pending) {
          status = "pending";
          activeSub = pending;
        } else if (expired) {
          status = "expired";
          activeSub = expired;
        }
      }
    }

    const liveGrant = (type: "complimentary" | "trial") =>
      (grants || []).find((g) => {
        const end = g.access_end ? new Date(g.access_end) : null;
        return g.grant_type === type && (!end || end > now);
      });
    const comp = liveGrant("complimentary") ?? liveGrant("trial");
    if (comp && status !== "active") {
      status = comp.grant_type === "trial" ? "trial" : "complimentary";
    }

    const isActive = status === "active" || status === "complimentary" || status === "trial";
    const expiresAt = activeSub?.access_end ? new Date(activeSub.access_end) : comp?.access_end ? new Date(comp.access_end) : null;
    const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)) : 0;

    setState({
      loading: false,
      isActive,
      status,
      plan: activeSub?.subscription_plans?.name || (comp ? "Complimentary" : null),
      planType: activeSub?.subscription_plans?.plan_type || activeSub?.plan_type || null,
      expiresAt,
      daysRemaining,
      subscription: activeSub,
      grants: grants || [],
      refresh: load,
    });
  }, [user, role]);

  useEffect(() => {
    load();
    if (!user) return;

    // realtime: refresh when payment or subscription rows change for this user.
    // Use a random suffix so a re-mounted hook never reattaches `.on()` callbacks
    // to an already-subscribed channel (which throws and white-screens the portal).
    const channel = supabase
      .channel(`subscription-realtime-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "access_grants" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "parent_students" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  return state;
}
