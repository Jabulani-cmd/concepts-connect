// DEMO MODE store for the Teacher AI Assistant.
// Records live in the browser (localStorage) - nothing is written to the school database.
import { useEffect, useState } from "react";

export type StoreKey = "lesson_plans" | "generated_materials" | "rubrics" | "student_risk_flags";

const PREFIX = "mbs.demo.ai.";
const listeners = new Set<() => void>();

function read<T>(key: StoreKey): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: StoreKey, rows: T[]) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rows));
  } catch {
    /* quota - demo only */
  }
  listeners.forEach((l) => l());
}

export function listRows<T>(key: StoreKey): T[] {
  return read<T>(key);
}

export type StoredRow = { id: string; created_at: string };

export function addRow<T extends object>(key: StoreKey, row: T): T & StoredRow {
  const full: T & StoredRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
  write(key, [full, ...read<T>(key)]);
  return full;
}

export function updateRow(key: StoreKey, id: string, patch: Record<string, unknown>) {
  write(
    key,
    read<StoredRow>(key).map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );
}

export function removeRow(key: StoreKey, id: string) {
  write(
    key,
    read<StoredRow>(key).filter((r) => r.id !== id),
  );
}

export function replaceAll<T>(key: StoreKey, rows: T[]) {
  write(key, rows);
}

/** Live view of a demo table. */
export function useDemoRows<T>(key: StoreKey): (T & StoredRow)[] {
  const [rows, setRows] = useState<(T & StoredRow)[]>(() => read<T & StoredRow>(key));
  useEffect(() => {
    const update = () => setRows(read<T & StoredRow>(key));
    listeners.add(update);
    window.addEventListener("storage", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, [key]);
  return rows;
}
