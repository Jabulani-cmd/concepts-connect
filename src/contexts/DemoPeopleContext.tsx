import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { DemoStudent, DemoParent } from "@/lib/demoSeeder";

interface Ctx {
  students: DemoStudent[];
  parents: DemoParent[];
  loadedAt: string | null;
  setSeed: (s: { students: DemoStudent[]; parents: DemoParent[] }) => void;
  clear: () => void;
}

const C = createContext<Ctx | null>(null);
const LS_KEY = "mt_demo_people_v2";

function load() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (!raw) return { students: [], parents: [], loadedAt: null };
    return JSON.parse(raw);
  } catch { return { students: [], parents: [], loadedAt: null }; }
}

export function DemoPeopleProvider({ children }: { children: ReactNode }) {
  const initial = load();
  const [students, setStudents] = useState<DemoStudent[]>(initial.students ?? []);
  const [parents, setParents] = useState<DemoParent[]>(initial.parents ?? []);
  const [loadedAt, setLoadedAt] = useState<string | null>(initial.loadedAt ?? null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({ students, parents, loadedAt }));
    } catch {
      // Storage unavailable (private browsing); the demo still works for this session.
    }
  }, [students, parents, loadedAt]);

  return (
    <C.Provider value={{
      students, parents, loadedAt,
      setSeed: (s) => { setStudents(s.students); setParents(s.parents); setLoadedAt(new Date().toISOString()); },
      clear: () => {
        setStudents([]); setParents([]); setLoadedAt(null);
        try { window.localStorage.removeItem(LS_KEY); } catch { /* storage unavailable */ }
      },
    }}>{children}</C.Provider>
  );
}

export function useDemoPeople() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useDemoPeople must be used inside DemoPeopleProvider");
  return ctx;
}
