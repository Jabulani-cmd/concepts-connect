import { CalendarCheck, ClipboardList, BookOpen, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatUSD } from "@/lib/currency";

interface Props {
  attendancePercent: number;
  upcomingAssessments: number;
  newMaterials: number;
  feeBalance: number | null;
}

export default function StudentMetricsCards({ attendancePercent, upcomingAssessments, newMaterials, feeBalance }: Props) {
  const metrics = [
    {
      label: "Attendance",
      value: `${attendancePercent}%`,
      icon: CalendarCheck,
      color: attendancePercent >= 80 ? "text-green-600" : attendancePercent >= 60 ? "text-yellow-600" : "text-destructive",
      bgColor: attendancePercent >= 80 ? "bg-green-50" : attendancePercent >= 60 ? "bg-yellow-50" : "bg-red-50",
    },
    {
      label: "Assessments Due",
      value: String(upcomingAssessments),
      icon: ClipboardList,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "New Materials",
      value: String(newMaterials),
      icon: BookOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    ...(feeBalance !== null ? [{
      label: feeBalance < 0 ? "Credit Balance" : "Fee Balance",
      value: feeBalance < 0 ? `${formatUSD(Math.abs(feeBalance), { decimals: false })} CR` : formatUSD(feeBalance, { decimals: false }),
      icon: DollarSign,
      color: feeBalance > 0 ? "text-destructive" : "text-green-600",
      bgColor: feeBalance > 0 ? "bg-red-50" : "bg-green-50",
    }] : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.label} className="border shadow-sm">
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${m.bgColor}`}>
                <Icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-base font-bold leading-tight sm:text-lg ${m.color}`}>{m.value}</p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
