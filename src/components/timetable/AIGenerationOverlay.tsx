import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  "Analyzing subject requirements",
  "Checking teacher availability",
  "Applying school constraints",
  "Optimizing period distribution",
  "Running conflict detection",
  "Finalizing timetable",
];

export default function AIGenerationOverlay({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, STEPS.length - 1)), 800);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center">
      <div className="max-w-md w-full p-8 rounded-2xl border-2 border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50 to-purple-50 dark:from-purple-950/40 dark:to-purple-950/40 shadow-xl">
        <div className="flex items-center gap-2 mb-6 text-purple-600 dark:text-purple-400">
          <Sparkles className="h-6 w-6 animate-pulse" />
          <h3 className="text-xl font-bold">AI is building your timetable…</h3>
        </div>
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i <= idx ? 1 : 0.4, x: 0 }}
              className="flex items-center gap-3 text-sm"
            >
              {i < idx ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                i === idx ? <Loader2 className="h-4 w-4 animate-spin text-purple-600" /> :
                <div className="h-4 w-4 rounded-full border-2 border-muted" />}
              <span>{s}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
