import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, BedDouble, HeartPulse, Library, Package, CalendarOff, type LucideIcon } from "lucide-react";
import schoolLogo from "@/assets/concepts-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { useAuth } from "@/contexts/AuthContext";
import BoardingManagement from "@/pages/admin/BoardingManagement";
import InventoryManagement from "@/pages/admin/InventoryManagement";
import StaffLeaveRequest from "@/components/teacher/StaffLeaveRequest";

export type SupportPortalRole = "boarding" | "nurse" | "librarian" | "storekeeper";

interface PortalConfig {
  title: string;
  subtitle: string;
  workLabel: string;
  workIcon: LucideIcon;
  work: ReactNode;
}

/** What each support role works on. Messaging comes from the portal layout. */
const PORTALS: Record<SupportPortalRole, PortalConfig> = {
  boarding: {
    title: "Boarding Portal",
    subtitle: "Boarding Master & Matron",
    workLabel: "Boarding",
    workIcon: BedDouble,
    work: <BoardingManagement />,
  },
  nurse: {
    title: "Sick Bay Portal",
    subtitle: "Sister-in-Charge",
    workLabel: "Sick Bay",
    workIcon: HeartPulse,
    work: <BoardingManagement tabs={["health"]} title="Sick Bay Visits" />,
  },
  librarian: {
    title: "Library Portal",
    subtitle: "Librarian",
    workLabel: "Library",
    workIcon: Library,
    work: <InventoryManagement tabs={["textbooks", "dashboard", "transactions", "categories"]} />,
  },
  storekeeper: {
    title: "Stores Portal",
    subtitle: "Stores & Laboratory",
    workLabel: "Stores",
    workIcon: Package,
    work: <InventoryManagement />,
  },
};

/** Portal for boarding, sick-bay, library and stores staff: their work area and their leave. */
export default function SupportStaffPortal({ role }: { role: SupportPortalRole }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const portal = PORTALS[role];
  const WorkIcon = portal.workIcon;

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 sm:h-20 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="Concepts Learning Academy" className="h-auto w-11 object-contain sm:w-16" />
            <span className="font-heading text-sm sm:text-lg font-bold text-primary">{portal.title}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">{portal.subtitle}</span>
            <LanguageSelect />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex"><LogOut className="mr-1 h-4 w-4" /> Logout</Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden h-8 w-8" aria-label="Logout"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container px-3 sm:px-4 py-4 sm:py-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 sm:mb-6 font-heading text-lg sm:text-2xl font-bold text-primary">
          {portal.title}
        </motion.h1>

        <Tabs defaultValue="work" className="space-y-4 sm:space-y-6">
          <TabsList className="h-auto gap-1">
            <TabsTrigger value="work" className="text-xs sm:text-sm"><WorkIcon className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> {portal.workLabel}</TabsTrigger>
            <TabsTrigger value="leave" className="text-xs sm:text-sm"><CalendarOff className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> My Leave</TabsTrigger>
          </TabsList>
          <TabsContent value="work">{portal.work}</TabsContent>
          <TabsContent value="leave"><StaffLeaveRequest /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
