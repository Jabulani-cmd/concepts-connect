import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, DollarSign, ShieldCheck, FileSearch, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import schoolLogo from "@/assets/concepts-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import FinanceManagement from "@/pages/admin/FinanceManagement";
import FinanceApprovalsPanel from "@/components/finance/FinanceApprovalsPanel";
import AuditLogs from "@/pages/admin/AuditLogs";
import AgentFindingsPanel from "@/components/agent/AgentFindingsPanel";

export default function FinanceDashboard() {
  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  const isBursar = role === "bursar";
  const portalTitle = isBursar ? "Bursar Portal" : "Finance Clerk Portal";
  const portalSubtitle = isBursar
    ? "Oversight, audit and approvals over all finance clerk activity"
    : "Daily finance operations: destructive actions require Bursar approval";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Live pending-approvals badge for the bursar.
  useEffect(() => {
    if (!isBursar) return;
    const load = async () => {
      const { count } = await supabase
        .from("finance_approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingCount(count || 0);
    };
    load();
    const channel = supabase
      .channel(`bursar-approvals-badge-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_approval_requests" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isBursar]);

  return (
    <div className="min-h-screen bg-section-warm">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={schoolLogo}
              alt="Concepts Learning Academy"
              className="h-auto w-11 object-contain sm:w-16"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-sm sm:text-lg font-bold text-primary">
                  {portalTitle}
                </h1>
                {isBursar && (
                  <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Supervisor
                  </Badge>
                )}
                {!isBursar && (
                  <Badge variant="outline" className="text-[10px]">
                    Clerk
                  </Badge>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-xs sm:text-sm"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              {isBursar ? (
                <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              ) : (
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              )}
              <h2 className="font-heading text-lg sm:text-2xl font-bold text-primary">
                {isBursar ? "Bursar: Finance Oversight" : "Finance Clerk: Daily Operations"}
              </h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{portalSubtitle}</p>
          </div>

          <div className="mb-4 sm:mb-6">
            <AgentFindingsPanel kinds={["fee_arrears"]} title="Agent: fee arrears" description="A weekly summary from the school agent of invoices unpaid more than 30 days after they were due." />
          </div>
          {isBursar ? (
            <Tabs defaultValue="approvals">
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide mb-4 sm:mb-6">
                <TabsList className="flex flex-nowrap gap-1 w-max sm:w-auto">
                  <TabsTrigger value="approvals" className="gap-1 text-xs sm:text-sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> Approvals
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-1 text-[10px] animate-pulse">
                        {pendingCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="finance" className="gap-1 text-xs sm:text-sm">
                    <DollarSign className="h-3.5 w-3.5" /> Finance Operations
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="gap-1 text-xs sm:text-sm">
                    <FileSearch className="h-3.5 w-3.5" /> Audit Trail
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="approvals">
                <FinanceApprovalsPanel />
              </TabsContent>
              <TabsContent value="finance">
                <FinanceManagement />
              </TabsContent>
              <TabsContent value="audit">
                <AuditLogs />
              </TabsContent>
            </Tabs>
          ) : (
            <FinanceManagement />
          )}
        </motion.div>
      </main>
    </div>
  );
}
