// Timetable shared helpers: period generation, color assignment, conflict detection.
import { SCHOOL_CONTACT_LINE, SCHOOL_NAME } from "@/lib/school";

export interface SlotRow {
  id?: string;
  definition_id?: string;
  day_of_week: number;
  period_index: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  break_label?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  teacher_name?: string | null;
  room?: string | null;
  notes?: string | null;
  is_manual_override?: boolean;
}

export interface BreakSpec {
  afterPeriod: number; // 0-based; break inserted after this period index
  label: string;
  minutes: number;
}

export interface PeriodTimes {
  index: number;
  start: string;
  end: string;
  isBreak: boolean;
  label?: string;
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const dayName = (n: number) => DAY_NAMES[n] ?? `Day ${n}`;
export const dayShort = (n: number) => dayName(n).slice(0, 3);

export const SUBJECT_PALETTE = [
  "#2563eb", "#0d9488", "#d97706", "#dc2626", "#7c3aed",
  "#059669", "#db2777", "#0891b2", "#65a30d", "#9333ea",
  "#ea580c", "#0284c7", "#16a34a", "#be185d", "#4338ca",
];

const colorMemo = new Map<string, string>();
export function colorForSubject(subject?: string | null) {
  if (!subject) return "#94a3b8";
  if (colorMemo.has(subject)) return colorMemo.get(subject)!;
  // deterministic hash
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  const c = SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
  colorMemo.set(subject, c);
  return c;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Build the period schedule for one day (periods + breaks interleaved). */
export function buildPeriodSchedule(
  dayStart: string,
  periodMinutes: number,
  periodsPerDay: number,
  breaks: BreakSpec[],
): PeriodTimes[] {
  const out: PeriodTimes[] = [];
  let cursor = dayStart;
  for (let i = 0; i < periodsPerDay; i++) {
    const end = addMinutes(cursor, periodMinutes);
    out.push({ index: i, start: cursor, end, isBreak: false });
    cursor = end;
    const br = breaks.find((b) => b.afterPeriod === i);
    if (br) {
      const brEnd = addMinutes(cursor, br.minutes);
      out.push({ index: -1, start: cursor, end: brEnd, isBreak: true, label: br.label });
      cursor = brEnd;
    }
  }
  return out;
}

/** Generate empty slots for a fresh definition. */
export function generateBlankSlots(
  definitionId: string,
  schoolDays: number[],
  schedule: PeriodTimes[],
): SlotRow[] {
  const slots: SlotRow[] = [];
  for (const day of schoolDays) {
    for (const p of schedule) {
      slots.push({
        definition_id: definitionId,
        day_of_week: day,
        period_index: p.isBreak ? -100 - day * 10 - slots.length : p.index,
        start_time: p.start,
        end_time: p.end,
        is_break: p.isBreak,
        break_label: p.label ?? null,
      });
    }
  }
  return slots;
}

export interface ConflictRow {
  conflict_type: string;
  severity: "info" | "warning" | "error";
  description: string;
  slot_ids: string[];
}

/** Detect conflicts in a slot set. */
export function detectConflicts(slots: SlotRow[]): ConflictRow[] {
  const conflicts: ConflictRow[] = [];
  const teacherMap = new Map<string, SlotRow[]>(); // key = day-period-teacher
  const roomMap = new Map<string, SlotRow[]>();

  for (const s of slots) {
    if (s.is_break || !s.subject_name) continue;
    if (s.teacher_name) {
      const k = `${s.day_of_week}-${s.period_index}-${s.teacher_name.toLowerCase()}`;
      const arr = teacherMap.get(k) ?? [];
      arr.push(s);
      teacherMap.set(k, arr);
    }
    if (s.room) {
      const k = `${s.day_of_week}-${s.period_index}-${s.room.toLowerCase()}`;
      const arr = roomMap.get(k) ?? [];
      arr.push(s);
      roomMap.set(k, arr);
    }
  }

  for (const [, arr] of teacherMap) {
    if (arr.length > 1) {
      conflicts.push({
        conflict_type: "teacher_double",
        severity: "error",
        description: `${arr[0].teacher_name} is double-booked on ${dayName(arr[0].day_of_week)} period ${arr[0].period_index + 1}.`,
        slot_ids: arr.map((s) => s.id!).filter(Boolean),
      });
    }
  }
  for (const [, arr] of roomMap) {
    if (arr.length > 1) {
      conflicts.push({
        conflict_type: "room_double",
        severity: "error",
        description: `Room ${arr[0].room} is assigned twice on ${dayName(arr[0].day_of_week)} period ${arr[0].period_index + 1}.`,
        slot_ids: arr.map((s) => s.id!).filter(Boolean),
      });
    }
  }
  return conflicts;
}

/** Periods used per subject in a slot set. */
export function periodsBySubject(slots: SlotRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of slots) {
    if (s.is_break || !s.subject_name) continue;
    out[s.subject_name] = (out[s.subject_name] ?? 0) + 1;
  }
  return out;
}

/** Simple printable HTML for a single timetable definition. */
export function printableTimetableHtml(
  defName: string,
  schoolDays: number[],
  schedule: PeriodTimes[],
  slots: SlotRow[],
): string {
  const slotByKey = new Map<string, SlotRow>();
  for (const s of slots) slotByKey.set(`${s.day_of_week}-${s.period_index}`, s);

  const rows = schedule.map((p) => {
    if (p.isBreak) {
      return `<tr><td style="background:#f3f4f6;font-weight:600">${p.start}-${p.end}<br/><small>${p.label ?? "Break"}</small></td>${schoolDays.map(() => `<td style="background:#f3f4f6;text-align:center">${p.label ?? "Break"}</td>`).join("")}</tr>`;
    }
    const cells = schoolDays.map((d) => {
      const s = slotByKey.get(`${d}-${p.index}`);
      if (!s || !s.subject_name) return `<td style="padding:8px;border:1px solid #e5e7eb">&nbsp;</td>`;
      const color = colorForSubject(s.subject_name);
      return `<td style="padding:8px;border:1px solid #e5e7eb;border-left:4px solid ${color}">
        <strong>${s.subject_name}</strong><br/>
        <small>${s.teacher_name ?? ""}</small><br/>
        <small>${s.room ?? ""}</small>
      </td>`;
    }).join("");
    return `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">${p.start}-${p.end}</td>${cells}</tr>`;
  }).join("");

  return `<html><head><title>${defName}</title><style>
    body{font-family:system-ui,Segoe UI,Roboto,sans-serif;padding:24px}
    h1{margin:0 0 16px}
    .school{margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #0f172a}
    .school strong{font-size:16px}
    .school div{font-size:12px;color:#475569}
    table{border-collapse:collapse;width:100%}
    th{padding:8px;background:#0f172a;color:white;text-align:left;border:1px solid #0f172a}
    @media print { @page { size: landscape; } }
  </style></head><body>
    <div class="school"><strong>${SCHOOL_NAME}</strong><div>${SCHOOL_CONTACT_LINE}</div></div>
    <h1>${defName}</h1>
    <table>
      <thead><tr><th>Time</th>${schoolDays.map((d) => `<th>${dayName(d)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;
}
