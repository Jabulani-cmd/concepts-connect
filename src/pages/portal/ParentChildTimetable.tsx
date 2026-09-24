import PortalTimetableView from "@/components/allocation/PortalTimetableView";
import { useAllocation } from "@/contexts/AllocationContext";

export default function ParentChildTimetable() {
  const { classes } = useAllocation();
  const childClass = classes[0];
  return (
    <PortalTimetableView
      mode="class"
      classId={childClass?.id}
      title={`Your child's timetable: ${childClass?.name ?? ""}`}
      subtitle="Period, subject, teacher and room for every lesson."
    />
  );
}
