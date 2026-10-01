import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCHOOL_NAME } from "@/lib/school";

/** The ways a Zimbabwean family can pay online, shown wherever payment is asked for. */
const PAYMENT_CHANNELS = ["EcoCash", "OneMoney", "InnBucks", "ZIPIT", "Visa / Mastercard", "Bank transfer"];

export function PaymentChannelList({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap justify-center gap-1.5 ${className}`}>
      {PAYMENT_CHANNELS.map((c) => (
        <span key={c} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{c}</span>
      ))}
    </div>
  );
}

/** For a learner whose portal is locked: tell the parent how to subscribe, ready to send on WhatsApp. */
export function AskParentToPay() {
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const text =
    `Hi, please subscribe to my ${SCHOOL_NAME} portal so I can see my timetable, marks, results and study materials. ` +
    `Sign in at ${site}/login, open the Parent Portal and choose View plans. ` +
    `You can pay online with EcoCash, OneMoney, InnBucks, ZIPIT, Visa/Mastercard or bank transfer.`;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">Your parent or guardian can pay online in the parent portal with:</p>
      <PaymentChannelList />
      <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 h-4 w-4" /> Send to my parent on WhatsApp
        </a>
      </Button>
    </div>
  );
}
