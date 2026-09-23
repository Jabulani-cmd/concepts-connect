import PortalTimetableView from "@/components/allocation/PortalTimetableView";
import { useAllocation } from "@/contexts/AllocationContext";
import SubscriptionGate from "@/components/subscription/SubscriptionGate";
import { useSubscription } from "@/hooks/useSubscription";

export default function StudentMyTimetable() {
  const { classes } = useAllocation();
  const subscription = useSubscription();
  const myClass = classes[0]; // demo: Form 1A

  if (subscription.loading || !subscription.isActive) {
    return <SubscriptionGate feature="the timetable" hard><span /></SubscriptionGate>;
  }

  return (
    <PortalTimetableView
      mode="class"
      classId={myClass?.id}
      title={`Class Timetable — ${myClass?.name ?? ""}`}
      subtitle="Every period shows your subject, teacher and venue."
    />
  );
}
