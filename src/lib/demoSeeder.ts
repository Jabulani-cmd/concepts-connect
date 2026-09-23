// @ts-nocheck
// Demo data seeder — generates a complete realistic Zimbabwean secondary school dataset
// (Form 1–6, ZIMSEC curriculum, US$/ZiG fees, +263 phone numbers).
import type {
  Teacher, Subject, Room, SchoolClass, Allocation, TimetableSlot, RoomType,
} from "@/contexts/AllocationContext";

export interface DemoStudent {
  id: string;
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  admissionNumber: string;
  grade: number;          // 1–6 (Form level)
  form: number;           // alias === grade
  stream: string;         // "A" | "B" | "C"
  classId: string;
  className: string;
  boardingStatus: "day" | "boarding";
  email: string;
  password: string;
}

export interface DemoParent {
  id: string;
  studentId: string;
  fullName: string;
  relationship: "Mother" | "Father" | "Guardian";
  phone: string;
  email: string;
  password: string;
}

export interface DemoSeed {
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  classes: SchoolClass[];
  allocations: Allocation[];
  slots: TimetableSlot[];
  students: DemoStudent[];
  parents: DemoParent[];
}

// Zimbabwean school day (07:30–14:15), 8×45min periods, break after P3, lunch after P5.
export const DEMO_PERIODS = [
  { period: 1, start: "07:30", end: "08:15" },
  { period: 2, start: "08:15", end: "09:00" },
  { period: 3, start: "09:00", end: "09:45" },
  { period: 4, start: "10:00", end: "10:45" },
  { period: 5, start: "10:45", end: "11:30" },
  { period: 6, start: "12:00", end: "12:45" },
  { period: 7, start: "12:45", end: "13:30" },
  { period: 8, start: "13:30", end: "14:15" },
];

const PALETTE = [
  "hsl(189 94% 43%)","hsl(217 91% 60%)","hsl(262 83% 58%)","hsl(330 81% 60%)",
  "hsl(24 95% 53%)","hsl(142 71% 45%)","hsl(45 93% 47%)","hsl(0 84% 60%)",
  "hsl(173 80% 40%)","hsl(280 65% 60%)","hsl(200 90% 50%)","hsl(15 90% 55%)",
  "hsl(100 60% 45%)","hsl(340 70% 55%)","hsl(50 80% 50%)",
];

// ZIMSEC-aligned subject catalogue. `grades` holds FORM levels (1–6).
const SUBJECT_DEFS: Array<{ name: string; allowed: RoomType[]; grades: number[]; periodsPerWeek: number }> = [
  { name: "Mathematics",        allowed: ["Regular"],                 grades: [1,2,3,4,5,6], periodsPerWeek: 6 },
  { name: "English Language",   allowed: ["Regular"],                 grades: [1,2,3,4,5,6], periodsPerWeek: 5 },
  { name: "Shona",              allowed: ["Regular"],                 grades: [1,2,3,4],     periodsPerWeek: 4 },
  { name: "Combined Science",   allowed: ["Lab"],                     grades: [1,2,3,4],     periodsPerWeek: 5 },
  { name: "Biology",            allowed: ["Lab"],                     grades: [5,6],         periodsPerWeek: 6 },
  { name: "Chemistry",          allowed: ["Lab"],                     grades: [5,6],         periodsPerWeek: 6 },
  { name: "Physics",            allowed: ["Lab"],                     grades: [5,6],         periodsPerWeek: 6 },
  { name: "Geography",          allowed: ["Regular"],                 grades: [1,2,3,4,5,6], periodsPerWeek: 3 },
  { name: "History",            allowed: ["Regular"],                 grades: [1,2,3,4],     periodsPerWeek: 3 },
  { name: "Heritage Studies",   allowed: ["Regular"],                 grades: [1,2,3,4],     periodsPerWeek: 2 },
  { name: "Agriculture",        allowed: ["Regular"],                 grades: [1,2],         periodsPerWeek: 3 },
  { name: "Physical Education", allowed: ["Sports Field","Hall"],     grades: [1,2],         periodsPerWeek: 2 },
  { name: "Accounting",         allowed: ["Regular"],                 grades: [3,4],         periodsPerWeek: 4 },
  { name: "Business Studies",   allowed: ["Regular"],                 grades: [3,4],         periodsPerWeek: 3 },
  { name: "Computer Science",   allowed: ["Computer Room"],           grades: [1,2,3,4,5,6], periodsPerWeek: 3 },
];

const ROOM_DEFS: Array<{ name: string; type: RoomType; capacity: number }> = [
  ...Array.from({ length: 18 }, (_, i) => ({ name: `Room ${i + 1}`, type: "Regular" as RoomType, capacity: 45 })),
  { name: "Science Lab A",    type: "Lab",           capacity: 36 },
  { name: "Science Lab B",    type: "Lab",           capacity: 36 },
  { name: "Science Lab C",    type: "Lab",           capacity: 36 },
  { name: "Computer Lab 1",   type: "Computer Room", capacity: 35 },
  { name: "Computer Lab 2",   type: "Computer Room", capacity: 35 },
  { name: "Assembly Hall",    type: "Hall",          capacity: 400 },
  { name: "Sports Field",     type: "Sports Field",  capacity: 300 },
  { name: "Library",          type: "Library",       capacity: 80 },
];

// Representative Zimbabwean name pools (Shona and Ndebele).
const ZW_FIRST_M = ["Tinashe","Tafadzwa","Tendai","Farai","Munashe","Takudzwa","Simbarashe","Blessing","Tatenda","Nyasha","Kudakwashe","Panashe","Anesu","Tapiwa","Shingirai","Batsirai","Mthokozisi","Sibusiso","Nkosana","Themba","Bongani","Mqondisi","Nkosilathi","Thulani","Brighton","Innocent","Prosper","Tonderai","Garikai","Munyaradzi","Tawanda","Ngonidzashe","Tichaona","Learnmore","Wellington","Tsungai","Mduduzi","Takunda","Ngonidzashe","Admire"];
const ZW_FIRST_F = ["Chipo","Rudo","Tariro","Ropafadzo","Rutendo","Nyaradzo","Fadzai","Vimbai","Tsitsi","Chiedza","Precious","Memory","Shamiso","Tanyaradzwa","Anashe","Nokutenda","Kudzai","Netsai","Sibongile","Nokuthula","Thandeka","Sithembile","Nomsa","Nobuhle","Busisiwe","Melody","Patience","Faith","Grace","Mercy","Rumbidzai","Tapiwanashe","Loveness","Primrose","Nyasha","Varaidzo","Tendai","Sekai","Zvikomborero","Michelle"];
const ZW_SURNAMES = ["Moyo","Ncube","Sibanda","Dube","Nyoni","Mpofu","Ndlovu","Chikwanha","Chirwa","Marufu","Mutasa","Mangwiro","Chigumba","Makoni","Mudzuri","Zvobgo","Gumbo","Shumba","Mhlanga","Nkomo","Banda","Matongo","Muchena","Nyamande","Zhou","Katsande","Mabhena","Chidzero","Murambadoro","Masuku","Tshuma","Maposa","Mandaza","Rusike","Chakanyuka","Madzivanyika","Chinamasa","Mavhunga","Bhebhe","Sithole","Mutsvangwa","Nhongo","Mupfumi","Chivasa","Manyika","Muzenda","Gwanzura","Magaya","Chitsa","Mhembere"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

// Form structure: O-level (1–4) three streams, A-level (5–6) two streams. Total = 500 learners.
const CLASS_PLAN: Array<{ form: number; stream: string; size: number }> = [
  ...[1, 2, 3, 4].flatMap(form => (["A", "B", "C"] as const).map(stream => ({ form, stream, size: 35 }))),
  ...[5, 6].flatMap(form => (["A", "B"] as const).map(stream => ({ form, stream, size: form === 5 ? 22 : 18 }))),
]; // 12 × 35 = 420, + (22×2) + (18×2) = 500

export function generateDemoSeed(): DemoSeed {
  const rooms: Room[] = ROOM_DEFS.map((r, i) => ({ id: `rm-${i + 1}`, ...r }));

  const subjects: Subject[] = SUBJECT_DEFS.map((s, i) => ({
    id: `sub-${i + 1}`,
    name: s.name,
    color: PALETTE[i % PALETTE.length],
    allowedRoomTypes: s.allowed,
  }));

  // ---- Teachers (40) — Zimbabwean names, @schooldemo.com / Teacher@2025 ----
  const teachers: Teacher[] = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const isFemale = i % 2 === 0;
    const first = isFemale ? pick(ZW_FIRST_F, i * 3 + 3) : pick(ZW_FIRST_M, i * 3 + 1);
    const surname = pick(ZW_SURNAMES, i * 7 + 1);
    const title = isFemale ? (i % 4 === 0 ? "Ms." : "Mrs.") : "Mr.";
    let email = `${first.toLowerCase()}.${surname.toLowerCase()}@schooldemo.com`;
    if (usedEmails.has(email)) email = `${first.toLowerCase()}.${surname.toLowerCase()}${i + 1}@schooldemo.com`;
    usedEmails.add(email);
    teachers.push({
      id: `t-${i + 1}`,
      name: `${title} ${first} ${surname}`,
      email,
      employeeNumber: `T${String(i + 1).padStart(3, "0")}`,
      employmentType: i % 11 === 0 ? "Part-time" : "Full-time",
      maxPeriodsPerWeek: i % 11 === 0 ? 18 : 30,
      preferredTime: "Both",
      qualifiedSubjects: [],
      qualifiedGrades: [1, 2, 3, 4, 5, 6],
    });
  }
  // Give each subject at least 4 qualified teachers (enough capacity for 16 classes).
  subjects.forEach((sub, si) => {
    for (let k = 0; k < 4; k++) {
      const t = teachers[(si * 4 + k * 3) % teachers.length];
      if (!t.qualifiedSubjects.includes(sub.id)) t.qualifiedSubjects.push(sub.id);
    }
  });
  teachers.forEach((t, i) => {
    if (t.qualifiedSubjects.length === 0) t.qualifiedSubjects.push(subjects[i % subjects.length].id);
  });

  // ---- Classes: Form 1A..4C plus Form 5A/B, 6A/B = 16 classes ----
  const classes: SchoolClass[] = CLASS_PLAN.map((plan, idx) => {
    const id = `c-${plan.form}${plan.stream}`;
    const classTeacher = teachers[idx % teachers.length];
    const applicableSubjects = SUBJECT_DEFS
      .map((s, i) => ({ s, id: `sub-${i + 1}` }))
      .filter(({ s }) => s.grades.includes(plan.form))
      .map(({ s, id: sid }) => ({
        subjectId: sid,
        periodsPerWeek: s.periodsPerWeek,
        roomType: s.allowed[0],
      }));
    return {
      id,
      name: `Form ${plan.form}${plan.stream}`,
      gradeLevel: plan.form,
      stream: plan.stream,
      studentCount: plan.size,
      classTeacherId: classTeacher.id,
      subjects: applicableSubjects,
    };
  });

  // ---- Students (500 across Form 1–6) ----
  const students: DemoStudent[] = [];
  let sIdx = 0;
  CLASS_PLAN.forEach((plan) => {
    const c = classes.find(x => x.id === `c-${plan.form}${plan.stream}`)!;
    for (let n = 0; n < plan.size; n++) {
      const female = sIdx % 2 === 0;
      const first = female ? pick(ZW_FIRST_F, sIdx * 5 + 5) : pick(ZW_FIRST_M, sIdx * 5 + 9);
      const surname = pick(ZW_SURNAMES, sIdx * 11 + 13);
      const age = 12 + plan.form;              // Form 1 ≈ 13 yrs
      const birthYear = new Date().getFullYear() - age;
      const month = ((sIdx * 3) % 12) + 1;
      const day = ((sIdx * 7) % 27) + 1;
      students.push({
        id: `st-${sIdx + 1}`,
        fullName: `${first} ${surname}`,
        dob: `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        gender: female ? "Female" : "Male",
        admissionNumber: `STU${String(sIdx + 1).padStart(4, "0")}`,
        grade: plan.form,
        form: plan.form,
        stream: plan.stream,
        classId: c.id,
        className: c.name,
        boardingStatus: sIdx % 3 === 0 ? "boarding" : "day",
        email: `${first.toLowerCase()}.${surname.toLowerCase()}${sIdx + 1}@student.schooldemo.com`,
        password: "Student@2025",
      });
      sIdx++;
    }
  });

  // ---- Parents / guardians (2 per learner, +263 mobile numbers) ----
  const parents: DemoParent[] = [];
  students.forEach((stu, i) => {
    const surname = stu.fullName.split(" ").slice(-1)[0];
    const father = pick(ZW_FIRST_M, i * 3 + 4);
    const mother = pick(ZW_FIRST_F, i * 3 + 6);
    const cleanSurn = surname.toLowerCase();
    const num = i + 1;
    const line = String(1000000 + i * 7).slice(1);   // 6 digits
    parents.push({
      id: `p-${i * 2 + 1}`,
      studentId: stu.id,
      fullName: `${father} ${surname}`,
      relationship: "Father",
      phone: `+263 77 ${line.slice(0, 3)} ${line.slice(3)}`,
      email: `${father.toLowerCase()}.${cleanSurn}p1.${num}@parent.schooldemo.com`,
      password: "Parent@2025",
    });
    parents.push({
      id: `p-${i * 2 + 2}`,
      studentId: stu.id,
      fullName: `${mother} ${surname}`,
      relationship: "Mother",
      phone: `+263 71 ${line.slice(0, 3)} ${line.slice(3)}`,
      email: `${mother.toLowerCase()}.${cleanSurn}p2.${num}@parent.schooldemo.com`,
      password: "Parent@2025",
    });
  });

  // ---- Allocations (spread the load across qualified teachers) ----
  const allocations: Allocation[] = [];
  const teacherLoad = new Map<string, number>();
  for (const c of classes) {
    for (const cs of c.subjects) {
      const qualified = teachers.filter(t => t.qualifiedSubjects.includes(cs.subjectId));
      const teacher = qualified
        .slice()
        .sort((a, b) => (teacherLoad.get(a.id) ?? 0) - (teacherLoad.get(b.id) ?? 0))[0] ?? teachers[0];
      teacherLoad.set(teacher.id, (teacherLoad.get(teacher.id) ?? 0) + cs.periodsPerWeek);
      allocations.push({
        id: `a-${c.id}-${cs.subjectId}`,
        classId: c.id,
        subjectId: cs.subjectId,
        teacherId: teacher.id,
        periodsPerWeek: cs.periodsPerWeek,
      });
    }
  }

  // ---- Timetable slots ----
  const slots: TimetableSlot[] = [];
  for (const c of classes) {
    for (let day = 0; day < 5; day++) {
      for (const p of DEMO_PERIODS) {
        slots.push({
          id: `s-${c.id}-${day}-${p.period}`,
          classId: c.id,
          day, period: p.period,
          startTime: p.start, endTime: p.end,
        });
      }
    }
  }

  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const placements = allocations.flatMap(a => {
    const sub = subjects.find(s => s.id === a.subjectId)!;
    return Array(a.periodsPerWeek).fill(null).map(() => ({ alloc: a, constraint: sub.allowedRoomTypes.length, sub }));
  }).sort((x, y) => x.constraint - y.constraint);

  for (const { alloc, sub } of placements) {
    const candidateRooms = rooms.filter(r => sub.allowedRoomTypes.includes(r.type));
    const open = slots
      .filter(s => s.classId === alloc.classId && !s.subjectId)
      .sort((a, b) => a.day - b.day || a.period - b.period);
    for (const slot of open) {
      const tKey = `${slot.day}-${slot.period}-${alloc.teacherId}`;
      if (teacherBusy.has(tKey)) continue;
      const room = candidateRooms.find(r => !roomBusy.has(`${slot.day}-${slot.period}-${r.id}`));
      if (!room) continue;
      slot.subjectId = alloc.subjectId;
      slot.teacherId = alloc.teacherId;
      slot.roomId = room.id;
      teacherBusy.add(tKey);
      roomBusy.add(`${slot.day}-${slot.period}-${room.id}`);
      break;
    }
  }

  const studyHall: Subject = { id: "sub-study", name: "Private Study", color: "hsl(220 15% 60%)", allowedRoomTypes: ["Regular","Library","Hall"] };
  let injectedStudy = false;
  for (const slot of slots) {
    if (slot.subjectId) continue;
    injectedStudy = true;
    const cls = classes.find(c => c.id === slot.classId)!;
    const teacherId = cls.classTeacherId ?? teachers[0].id;
    const tKey = `${slot.day}-${slot.period}-${teacherId}`;
    const altTeacher = teacherBusy.has(tKey)
      ? (teachers.find(t => !teacherBusy.has(`${slot.day}-${slot.period}-${t.id}`)) ?? teachers[0])
      : (teachers.find(t => t.id === teacherId) ?? teachers[0]);
    const room = rooms.find(r => ["Regular","Library","Hall"].includes(r.type) && !roomBusy.has(`${slot.day}-${slot.period}-${r.id}`)) ?? rooms[0];
    slot.subjectId = studyHall.id;
    slot.teacherId = altTeacher.id;
    slot.roomId = room.id;
    teacherBusy.add(`${slot.day}-${slot.period}-${altTeacher.id}`);
    roomBusy.add(`${slot.day}-${slot.period}-${room.id}`);
  }
  if (injectedStudy && !subjects.find(s => s.id === studyHall.id)) subjects.push(studyHall);

  return { teachers, subjects, rooms, classes, allocations, slots, students, parents };
}
