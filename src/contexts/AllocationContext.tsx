import { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from "react";

const LS_KEY = "mt_demo_allocation_v1";
function loadLS<T>(field: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return field in parsed ? (parsed[field] as T) : fallback;
  } catch { return fallback; }
}

export type EmploymentType = "Full-time" | "Part-time" | "Contract";
export type PreferredTime = "Morning" | "Afternoon" | "Both";
export type RoomType = "Regular" | "Lab" | "Computer Room" | "Library" | "Sports Field" | "Hall";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  employmentType: EmploymentType;
  maxPeriodsPerWeek: number;
  preferredTime: PreferredTime;
  qualifiedSubjects: string[];
  qualifiedGrades: number[];
  photoUrl?: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  /** Allowed room types for this subject. First entry is preferred. */
  allowedRoomTypes: RoomType[];
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  stream?: string;
  studentCount: number;
  classTeacherId?: string;
  subjects: { subjectId: string; periodsPerWeek: number; roomType: RoomType }[];
}

export interface Allocation {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  periodsPerWeek: number;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  day: number;
  period: number;
  startTime: string;
  endTime: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
}

export interface TimetableConflict {
  id: string;
  type: "teacher_double" | "room_double" | "missing_field" | "wrong_room_type";
  severity: "error" | "warning";
  description: string;
  slotIds: string[];
  suggestion: string;
}

export interface TimetableNotification {
  id: string;
  at: string;
  kind: "ai_generated" | "slot_changed" | "substitution" | "venue_changed" | "time_changed";
  message: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  roomName?: string;
  startTime?: string;
  endTime?: string;
  day?: number;
  period?: number;
}

const PERIODS = [
  { period: 1, start: "07:30", end: "08:10" },
  { period: 2, start: "08:15", end: "08:55" },
  { period: 3, start: "09:00", end: "09:40" },
  { period: 4, start: "10:00", end: "10:40" },
  { period: 5, start: "10:45", end: "11:25" },
  { period: 6, start: "11:30", end: "12:10" },
  { period: 7, start: "13:00", end: "13:40" },
  { period: 8, start: "13:45", end: "14:25" },
];

const SUBJECT_PALETTE = [
  "hsl(189 94% 43%)", "hsl(217 91% 60%)", "hsl(262 83% 58%)", "hsl(330 81% 60%)",
  "hsl(24 95% 53%)", "hsl(142 71% 45%)", "hsl(45 93% 47%)", "hsl(0 84% 60%)",
  "hsl(173 80% 40%)", "hsl(280 65% 60%)",
];

const subjectSeed: Array<{ name: string; allowed: RoomType[] }> = [
  { name: "Mathematics", allowed: ["Regular"] },
  { name: "English", allowed: ["Regular"] },
  { name: "Combined Science", allowed: ["Lab"] },
  { name: "History", allowed: ["Regular"] },
  { name: "Geography", allowed: ["Regular"] },
  { name: "ICT", allowed: ["Computer Room"] },
  { name: "Shona", allowed: ["Regular"] },
  { name: "Physical Education", allowed: ["Hall", "Sports Field"] },
  { name: "Business Studies", allowed: ["Regular"] },
  { name: "Art", allowed: ["Regular"] },
];

const seedSubjects: Subject[] = subjectSeed.map((s, i) => ({
  id: `sub-${i + 1}`,
  name: s.name,
  color: SUBJECT_PALETTE[i],
  allowedRoomTypes: s.allowed,
}));

const seedRooms: Room[] = [
  { id: "rm-1", name: "Room 5", type: "Regular", capacity: 40 },
  { id: "rm-2", name: "Room 6", type: "Regular", capacity: 40 },
  { id: "rm-3", name: "Room 7", type: "Regular", capacity: 40 },
  { id: "rm-4", name: "Room 8", type: "Regular", capacity: 40 },
  { id: "rm-5", name: "Science Lab 1", type: "Lab", capacity: 32 },
  { id: "rm-6", name: "Computer Room A", type: "Computer Room", capacity: 30 },
  { id: "rm-7", name: "School Hall", type: "Hall", capacity: 200 },
  { id: "rm-8", name: "Sports Field", type: "Sports Field", capacity: 100 },
];

const seedTeachers: Teacher[] = [
  { id: "t-1", name: "Mr. T. Zulu", email: "zulu@mavingtech.com", employeeNumber: "MHS-S00001", employmentType: "Full-time", maxPeriodsPerWeek: 28, preferredTime: "Both", qualifiedSubjects: ["sub-1", "sub-9"], qualifiedGrades: [8, 9, 10] },
  { id: "t-2", name: "Mrs. N. Khumalo", email: "khumalo@mavingtech.com", employeeNumber: "MHS-S00002", employmentType: "Full-time", maxPeriodsPerWeek: 28, preferredTime: "Morning", qualifiedSubjects: ["sub-2", "sub-7"], qualifiedGrades: [8, 9, 10, 11] },
  { id: "t-3", name: "Mr. S. Mthembu", email: "mthembu@mavingtech.com", employeeNumber: "MHS-S00003", employmentType: "Full-time", maxPeriodsPerWeek: 28, preferredTime: "Both", qualifiedSubjects: ["sub-3", "sub-5"], qualifiedGrades: [8, 9, 10] },
  { id: "t-4", name: "Ms. Z. Ndlovu", email: "ndlovu@mavingtech.com", employeeNumber: "MHS-S00004", employmentType: "Part-time", maxPeriodsPerWeek: 16, preferredTime: "Afternoon", qualifiedSubjects: ["sub-6", "sub-10"], qualifiedGrades: [9, 10] },
  { id: "t-5", name: "Mr. B. Dlamini", email: "dlamini@mavingtech.com", employeeNumber: "MHS-S00005", employmentType: "Full-time", maxPeriodsPerWeek: 28, preferredTime: "Both", qualifiedSubjects: ["sub-4", "sub-7"], qualifiedGrades: [8, 9, 10, 11] },
  { id: "t-6", name: "Mrs. L. Mkhize", email: "mkhize@mavingtech.com", employeeNumber: "MHS-S00006", employmentType: "Full-time", maxPeriodsPerWeek: 28, preferredTime: "Morning", qualifiedSubjects: ["sub-8"], qualifiedGrades: [8, 9, 10, 11] },
];

const seedClasses: SchoolClass[] = [
  {
    id: "c-1", name: "Grade 8A", gradeLevel: 8, stream: "Sciences", studentCount: 32, classTeacherId: "t-1",
    subjects: [
      { subjectId: "sub-1", periodsPerWeek: 5, roomType: "Regular" },
      { subjectId: "sub-2", periodsPerWeek: 5, roomType: "Regular" },
      { subjectId: "sub-3", periodsPerWeek: 4, roomType: "Lab" },
      { subjectId: "sub-4", periodsPerWeek: 3, roomType: "Regular" },
      { subjectId: "sub-6", periodsPerWeek: 3, roomType: "Computer Room" },
      { subjectId: "sub-8", periodsPerWeek: 2, roomType: "Sports Field" },
    ],
  },
  {
    id: "c-2", name: "Grade 9B", gradeLevel: 9, stream: "Commerce", studentCount: 30, classTeacherId: "t-2",
    subjects: [
      { subjectId: "sub-1", periodsPerWeek: 5, roomType: "Regular" },
      { subjectId: "sub-2", periodsPerWeek: 5, roomType: "Regular" },
      { subjectId: "sub-5", periodsPerWeek: 3, roomType: "Regular" },
      { subjectId: "sub-9", periodsPerWeek: 4, roomType: "Regular" },
      { subjectId: "sub-7", periodsPerWeek: 3, roomType: "Regular" },
      { subjectId: "sub-8", periodsPerWeek: 2, roomType: "Hall" },
    ],
  },
  {
    id: "c-3", name: "Grade 10C", gradeLevel: 10, stream: "Arts", studentCount: 28, classTeacherId: "t-5",
    subjects: [
      { subjectId: "sub-1", periodsPerWeek: 4, roomType: "Regular" },
      { subjectId: "sub-2", periodsPerWeek: 5, roomType: "Regular" },
      { subjectId: "sub-4", periodsPerWeek: 4, roomType: "Regular" },
      { subjectId: "sub-10", periodsPerWeek: 3, roomType: "Regular" },
      { subjectId: "sub-8", periodsPerWeek: 2, roomType: "Hall" },
    ],
  },
];

function seedAllocations(): Allocation[] {
  const out: Allocation[] = [];
  for (const c of seedClasses) {
    for (const s of c.subjects) {
      const teacher = seedTeachers.find(
        (t) => t.qualifiedSubjects.includes(s.subjectId) && t.qualifiedGrades.includes(c.gradeLevel),
      );
      if (teacher) {
        out.push({
          id: `a-${c.id}-${s.subjectId}`,
          classId: c.id,
          subjectId: s.subjectId,
          teacherId: teacher.id,
          periodsPerWeek: s.periodsPerWeek,
        });
      }
    }
  }
  return out;
}

/**
 * AI Agent — constraint-solving timetable generator.
 * Enforces: no teacher double-booking, no room double-booking, room-type rules
 * (PE → Hall/Sports Field, Lab subjects → Lab, ICT → Computer Room),
 * and guarantees every placed slot has subject + teacher + room + times.
 */
function aiGenerateTimetable(
  allocs: Allocation[],
  classes: SchoolClass[],
  subjects: Subject[],
  rooms: Room[],
  teachers: Teacher[],
): { slots: TimetableSlot[]; warnings: string[] } {
  const slots: TimetableSlot[] = [];
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const warnings: string[] = [];

  // Seed empty grid for every class.
  for (const c of classes) {
    for (let day = 0; day < 5; day++) {
      for (const p of PERIODS) {
        slots.push({
          id: `s-${c.id}-${day}-${p.period}`,
          classId: c.id,
          day,
          period: p.period,
          startTime: p.start,
          endTime: p.end,
        });
      }
    }
  }

  // Build placement queue: heaviest-constraint subjects first
  // (subjects with narrowest room allowances are placed before flexible ones).
  const queue = allocs.flatMap((a) => {
    const subj = subjects.find((s) => s.id === a.subjectId);
    const constraint = subj?.allowedRoomTypes.length ?? 99;
    return Array(a.periodsPerWeek).fill(null).map(() => ({ alloc: a, constraint }));
  }).sort((a, b) => a.constraint - b.constraint);

  for (const { alloc } of queue) {
    const subj = subjects.find((s) => s.id === alloc.subjectId)!;
    const allowedTypes = subj.allowedRoomTypes;
    const candidateRooms = rooms.filter((r) => allowedTypes.includes(r.type));
    let placed = false;

    // Try every (day, period) combination — prefer mornings for core subjects.
    const slotsOfClass = slots
      .filter((s) => s.classId === alloc.classId && !s.subjectId)
      .sort((a, b) => a.period - b.period || a.day - b.day);

    for (const slot of slotsOfClass) {
      if (teacherBusy.has(`${slot.day}-${slot.period}-${alloc.teacherId}`)) continue;
      const room = candidateRooms.find(
        (r) => !roomBusy.has(`${slot.day}-${slot.period}-${r.id}`),
      );
      if (!room) continue;
      slot.subjectId = alloc.subjectId;
      slot.teacherId = alloc.teacherId;
      slot.roomId = room.id;
      teacherBusy.add(`${slot.day}-${slot.period}-${alloc.teacherId}`);
      roomBusy.add(`${slot.day}-${slot.period}-${room.id}`);
      placed = true;
      break;
    }

    if (!placed) {
      const cls = classes.find((c) => c.id === alloc.classId);
      warnings.push(
        `Could not place ${subj.name} for ${cls?.name} — no free teacher/room slot satisfying constraints.`,
      );
    }
  }

  return { slots, warnings };
}

function validate(
  slots: TimetableSlot[],
  subjects: Subject[],
  teachers: Teacher[],
  rooms: Room[],
  classes: SchoolClass[],
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const teacherMap = new Map<string, TimetableSlot[]>();
  const roomMap = new Map<string, TimetableSlot[]>();

  for (const s of slots) {
    const hasAny = s.subjectId || s.teacherId || s.roomId;
    // Missing field check — only flag rows that were started.
    if (hasAny && (!s.subjectId || !s.teacherId || !s.roomId)) {
      const cls = classes.find((c) => c.id === s.classId);
      conflicts.push({
        id: `missing-${s.id}`,
        type: "missing_field",
        severity: "error",
        description: `${cls?.name} • Day ${s.day + 1} P${s.period} (${s.startTime}–${s.endTime}) is missing ${[
          !s.subjectId && "subject",
          !s.teacherId && "teacher",
          !s.roomId && "venue",
        ].filter(Boolean).join(", ")}.`,
        slotIds: [s.id],
        suggestion: "Open the slot editor and complete all four fields, or re-run the AI agent.",
      });
    }
    if (s.subjectId && s.teacherId) {
      const k = `${s.day}-${s.period}-${s.teacherId}`;
      const arr = teacherMap.get(k) ?? [];
      arr.push(s);
      teacherMap.set(k, arr);
    }
    if (s.subjectId && s.roomId) {
      const k = `${s.day}-${s.period}-${s.roomId}`;
      const arr = roomMap.get(k) ?? [];
      arr.push(s);
      roomMap.set(k, arr);
    }
    if (s.subjectId && s.roomId) {
      const subj = subjects.find((x) => x.id === s.subjectId);
      const room = rooms.find((x) => x.id === s.roomId);
      if (subj && room && !subj.allowedRoomTypes.includes(room.type)) {
        const cls = classes.find((c) => c.id === s.classId);
        conflicts.push({
          id: `roomtype-${s.id}`,
          type: "wrong_room_type",
          severity: "error",
          description: `${subj.name} (${cls?.name}, P${s.period}) is in ${room.name} (${room.type}) — requires ${subj.allowedRoomTypes.join(" or ")}.`,
          slotIds: [s.id],
          suggestion: `Move to a ${subj.allowedRoomTypes[0]} room such as ${rooms.find((r) => subj.allowedRoomTypes.includes(r.type))?.name ?? "(none available)"}.`,
        });
      }
    }
  }

  for (const [k, arr] of teacherMap) {
    if (arr.length > 1) {
      const t = teachers.find((x) => x.id === arr[0].teacherId);
      conflicts.push({
        id: `tdouble-${k}`,
        type: "teacher_double",
        severity: "error",
        description: `${t?.name ?? "Teacher"} is double-booked at Day ${arr[0].day + 1} P${arr[0].period} (${arr[0].startTime}–${arr[0].endTime}) across ${arr.length} classes.`,
        slotIds: arr.map((s) => s.id),
        suggestion: `Reassign one class to another qualified teacher, or move the slot to a free period.`,
      });
    }
  }
  for (const [k, arr] of roomMap) {
    if (arr.length > 1) {
      const r = rooms.find((x) => x.id === arr[0].roomId);
      conflicts.push({
        id: `rdouble-${k}`,
        type: "room_double",
        severity: "error",
        description: `${r?.name ?? "Room"} is double-booked at Day ${arr[0].day + 1} P${arr[0].period} (${arr[0].startTime}–${arr[0].endTime}).`,
        slotIds: arr.map((s) => s.id),
        suggestion: `Switch one class to another ${r?.type ?? "compatible"} room.`,
      });
    }
  }
  return conflicts;
}

const initialAllocations = seedAllocations();
const initialBuild = aiGenerateTimetable(initialAllocations, seedClasses, seedSubjects, seedRooms, seedTeachers);

interface Ctx {
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  classes: SchoolClass[];
  allocations: Allocation[];
  slots: TimetableSlot[];
  periodSchedule: typeof PERIODS;
  conflicts: TimetableConflict[];
  notifications: TimetableNotification[];
  publishedAt: string | null;
  setAllocation: (classId: string, subjectId: string, teacherId: string) => void;
  removeAllocation: (allocationId: string) => void;
  updateSlot: (slotId: string, patch: Partial<TimetableSlot>) => void;
  rebuildTimetable: () => void;
  runAIAgent: () => { warnings: string[]; placed: number };
  publishTimetable: () => void;
  clearNotifications: () => void;
  updateTeacher: (id: string, patch: Partial<Teacher>) => void;
  replaceAllData: (data: { teachers: Teacher[]; subjects: Subject[]; rooms: Room[]; classes: SchoolClass[]; allocations: Allocation[]; slots: TimetableSlot[] }) => void;
  resetToSeed: () => void;
}

const AllocationCtx = createContext<Ctx | null>(null);

export function AllocationProvider({ children }: { children: ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>(() => loadLS("teachers", seedTeachers));
  const [subjects, setSubjects] = useState<Subject[]>(() => loadLS("subjects", seedSubjects));
  const [rooms, setRooms] = useState<Room[]>(() => loadLS("rooms", seedRooms));
  const [classes, setClasses] = useState<SchoolClass[]>(() => loadLS("classes", seedClasses));
  const [allocations, setAllocations] = useState<Allocation[]>(() => loadLS("allocations", initialAllocations));
  const [slots, setSlots] = useState<TimetableSlot[]>(() => loadLS("slots", initialBuild.slots));
  const [notifications, setNotifications] = useState<TimetableNotification[]>(() => loadLS("notifications", [
    {
      id: `n-init`,
      at: new Date().toISOString(),
      kind: "ai_generated",
      message: `AI Agent generated the master timetable — ${initialBuild.slots.filter((s) => s.subjectId).length} periods placed across ${seedClasses.length} classes.`,
    },
  ]));
  const [publishedAt, setPublishedAt] = useState<string | null>(() => loadLS("publishedAt", null));

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        teachers, subjects, rooms, classes, allocations, slots, notifications, publishedAt,
      }));
    } catch {
      // Storage unavailable (private browsing); state still works for this session.
    }
  }, [teachers, subjects, rooms, classes, allocations, slots, notifications, publishedAt]);

  const pushNotification = useCallback((n: Omit<TimetableNotification, "id" | "at">) => {
    setNotifications((prev) => [
      { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...n },
      ...prev,
    ].slice(0, 50));
  }, []);

  const conflicts = useMemo(
    () => validate(slots, subjects, teachers, rooms, classes),
    [slots, subjects, teachers, rooms, classes],
  );

  const value = useMemo<Ctx>(() => ({
    teachers,
    subjects,
    rooms,
    classes,
    allocations,
    slots,
    periodSchedule: PERIODS,
    conflicts,
    notifications,
    publishedAt,
    publishTimetable: () => {
      const now = new Date().toISOString();
      setPublishedAt(now);
      pushNotification({
        kind: "ai_generated",
        message: `Timetable published — synced to student, teacher and admin portals.`,
      });
    },
    setAllocation: (classId, subjectId, teacherId) => {
      setAllocations((prev) => {
        const existing = prev.find((a) => a.classId === classId && a.subjectId === subjectId);
        const cs = classes.find((c) => c.id === classId)?.subjects.find((s) => s.subjectId === subjectId);
        const periods = cs?.periodsPerWeek ?? 3;
        if (existing) return prev.map((a) => (a.id === existing.id ? { ...a, teacherId } : a));
        return [...prev, { id: `a-${Date.now()}`, classId, subjectId, teacherId, periodsPerWeek: periods }];
      });
    },
    removeAllocation: (id) => setAllocations((prev) => prev.filter((a) => a.id !== id)),
    updateSlot: (id, patch) => {
      setSlots((prev) => prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // Emit a notification describing what changed.
        const subj = seedSubjects.find((x) => x.id === next.subjectId);
        const teacher = teachers.find((x) => x.id === next.teacherId);
        const room = seedRooms.find((x) => x.id === next.roomId);
        const cls = classes.find((c) => c.id === next.classId);
        const changes: string[] = [];
        if (patch.teacherId && patch.teacherId !== s.teacherId) changes.push("teacher substituted");
        if (patch.roomId && patch.roomId !== s.roomId) changes.push("venue changed");
        if ((patch.startTime && patch.startTime !== s.startTime) || (patch.endTime && patch.endTime !== s.endTime)) changes.push("time adjusted");
        if (patch.subjectId && patch.subjectId !== s.subjectId) changes.push("subject changed");
        const kind: TimetableNotification["kind"] = patch.teacherId && patch.teacherId !== s.teacherId
          ? "substitution"
          : patch.roomId && patch.roomId !== s.roomId
            ? "venue_changed"
            : (patch.startTime || patch.endTime)
              ? "time_changed"
              : "slot_changed";
        pushNotification({
          kind,
          message: `${cls?.name ?? ""} • ${subj?.name ?? "Slot"} — ${changes.join(", ") || "updated"}.`,
          subjectName: subj?.name,
          teacherName: teacher?.name,
          className: cls?.name,
          roomName: room?.name,
          startTime: next.startTime,
          endTime: next.endTime,
          day: next.day,
          period: next.period,
        });
        return next;
      }));
    },
    rebuildTimetable: () => {
      const built = aiGenerateTimetable(allocations, classes, subjects, rooms, teachers);
      setSlots(built.slots);
    },
    runAIAgent: () => {
      const built = aiGenerateTimetable(allocations, classes, subjects, rooms, teachers);
      setSlots(built.slots);
      const placed = built.slots.filter((s) => s.subjectId).length;
      pushNotification({
        kind: "ai_generated",
        message: `AI Agent regenerated the master timetable — ${placed} periods placed${built.warnings.length ? `, ${built.warnings.length} warning(s)` : ""}.`,
      });
      return { warnings: built.warnings, placed };
    },
    clearNotifications: () => setNotifications([]),
    updateTeacher: (id, patch) => setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    replaceAllData: (data) => {
      setTeachers(data.teachers);
      setSubjects(data.subjects);
      setRooms(data.rooms);
      setClasses(data.classes);
      setAllocations(data.allocations);
      setSlots(data.slots);
      setPublishedAt(new Date().toISOString());
      pushNotification({
        kind: "ai_generated",
        message: `Demo data loaded — ${data.classes.length} classes, ${data.teachers.length} teachers, ${data.slots.filter(s => s.subjectId).length} timetable periods.`,
      });
    },
    resetToSeed: () => {
      setTeachers(seedTeachers);
      setSubjects(seedSubjects);
      setRooms(seedRooms);
      setClasses(seedClasses);
      setAllocations(initialAllocations);
      setSlots(initialBuild.slots);
      setPublishedAt(null);
      setNotifications([]);
    },
  }), [teachers, subjects, rooms, classes, allocations, slots, conflicts, notifications, publishedAt, pushNotification]);

  return <AllocationCtx.Provider value={value}>{children}</AllocationCtx.Provider>;
}

export function useAllocation() {
  const ctx = useContext(AllocationCtx);
  if (!ctx) throw new Error("useAllocation must be used inside AllocationProvider");
  return ctx;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
