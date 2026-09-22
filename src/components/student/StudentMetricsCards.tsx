// @ts-nocheck
import { CalendarCheck, ClipboardList, BookOpen, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";

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
      color: "text-blue-600",
      bgColor: "bg-blue-50",
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
      value: feeBalance < 0 ? `${formatMoney(Math.abs(feeBalance), { decimals: false })} CR` : formatMoney(feeBalance, { decimals: false }),
      icon: DollarSign,
      color: feeBalance > 0 ? "text-destructive" : "text-green-600",
      bgColor: feeBalance > 0 ? "bg-red-50" : "bg-green-50",
    }] : []),
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.label} className="min-w-[140px] flex-shrink-0 border shadow-sm">
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.bgColor}`}>
                <Icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold leading-tight ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
