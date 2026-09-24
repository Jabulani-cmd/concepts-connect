import PortalTimetableView from "@/components/allocation/PortalTimetableView";
import { useAllocation } from "@/contexts/AllocationContext";

export default function TeacherMyTimetable() {
  const { teachers } = useAllocation();
  // Demo: first teacher represents the logged-in teacher.
  const me = teachers[0];
  return (
    <PortalTimetableView
      mode="teacher"
      teacherId={me?.id}
      title={`My Timetable: ${me?.name ?? ""}`}
      subtitle="Your classes this term. Real-time updates when admin reallocates."
    />
  );
}
