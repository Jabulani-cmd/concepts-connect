import { Home, BookOpen, ClipboardCheck, CalendarCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "materials", label: "Materials", icon: BookOpen },
  { id: "assessments", label: "Assess", icon: ClipboardCheck },
  { id: "attendance", label: "Attend", icon: CalendarCheck },
  { id: "profile", label: "Profile", icon: User },
];

export default function StudentBottomNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md safe-area-bottom md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
