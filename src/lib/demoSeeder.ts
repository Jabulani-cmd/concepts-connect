// Demo data seeder — generates a complete, realistic Zimbabwean secondary school dataset
// (Forms 1–6, ZIMSEC O-Level and A-Level subjects, +263 phone numbers).
import type {
  Teacher, Subject, Room, SchoolClass, Allocation, TimetableSlot, RoomType,
} from "@/contexts/AllocationContext";

export interface DemoStudent {
  id: string;
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  admissionNumber: string;
  form: number;           // 1–6
  stream: "A" | "B";
  classId: string;
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

// School day 07:30–14:15: 8 periods of 45 minutes, break after P3 and lunch after P5.
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

// ZIMSEC subject catalogue: O-Level for Forms 1–4, A-Level for Forms 5–6.
const O_LEVEL = [1, 2, 3, 4];
const A_LEVEL = [5, 6];
const SUBJECT_DEFS: Array<{ name: string; allowed: RoomType[]; forms: number[]; periodsPerWeek: number }> = [
  { name: "Mathematics",            allowed: ["Regular"],             forms: O_LEVEL, periodsPerWeek: 6 },
  { name: "English Language",       allowed: ["Regular"],             forms: O_LEVEL, periodsPerWeek: 5 },
  { name: "Shona",                  allowed: ["Regular"],             forms: O_LEVEL, periodsPerWeek: 4 },
  { name: "Combined Science",       allowed: ["Lab"],                 forms: O_LEVEL, periodsPerWeek: 5 },
  { name: "Heritage Studies",       allowed: ["Regular"],             forms: [1, 2], periodsPerWeek: 2 },
  { name: "History",                allowed: ["Regular"],             forms: O_LEVEL, periodsPerWeek: 3 },
  { name: "Geography",              allowed: ["Regular"],             forms: O_LEVEL, periodsPerWeek: 3 },
  { name: "Principles of Accounting", allowed: ["Regular"],           forms: [3, 4], periodsPerWeek: 4 },
  { name: "Commerce",               allowed: ["Regular"],             forms: [3, 4], periodsPerWeek: 3 },
  { name: "Agriculture",            allowed: ["Regular"],             forms: [1, 2], periodsPerWeek: 3 },
  { name: "Computer Science",       allowed: ["Computer Room"],       forms: [...O_LEVEL, ...A_LEVEL], periodsPerWeek: 3 },
  { name: "Physical Education",     allowed: ["Hall", "Sports Field"], forms: [...O_LEVEL, ...A_LEVEL], periodsPerWeek: 2 },
  { name: "Pure Mathematics",       allowed: ["Regular"],             forms: A_LEVEL, periodsPerWeek: 6 },
  { name: "Physics",                allowed: ["Lab"],                 forms: A_LEVEL, periodsPerWeek: 5 },
  { name: "Chemistry",              allowed: ["Lab"],                 forms: A_LEVEL, periodsPerWeek: 5 },
  { name: "Biology",                allowed: ["Lab"],                 forms: A_LEVEL, periodsPerWeek: 5 },
];

const ROOM_DEFS: Array<{ name: string; type: RoomType; capacity: number }> = [
  ...Array.from({ length: 12 }, (_, i) => ({ name: `Room ${i + 1}`, type: "Regular" as RoomType, capacity: 40 })),
  { name: "Science Lab A",    type: "Lab",           capacity: 32 },
  { name: "Science Lab B",    type: "Lab",           capacity: 32 },
  { name: "Computer Lab",     type: "Computer Room", capacity: 30 },
  { name: "Art Room",         type: "Regular",       capacity: 28 },
  { name: "Agriculture Room", type: "Regular",       capacity: 30 },
  { name: "School Hall",      type: "Hall",          capacity: 250 },
  { name: "Sports Field",     type: "Sports Field",  capacity: 200 },
  { name: "Library",          type: "Library",       capacity: 60 },
];

// Shona and Ndebele name pools.
const FIRST_M = ["Tatenda","Tinashe","Farai","Tafadzwa","Kudakwashe","Takudzwa","Tapiwa","Simbarashe","Tendai","Munyaradzi","Tawanda","Ngonidzashe","Anesu","Panashe","Nkosana","Mthokozisi","Sibusiso","Bekezela","Lwazi","Thabani","Nqobile","Mandla","Kundai","Tonderai","Blessing","Brighton"];
const FIRST_F = ["Nyasha","Ruvimbo","Rutendo","Chiedza","Tsitsi","Rumbidzai","Vimbai","Tariro","Chipo","Fadzai","Tanaka","Kudzai","Rufaro","Shamiso","Nokuthula","Sibongile","Thandeka","Nomalanga","Busisiwe","Sithabile","Zanele","Precious","Memory","Tendai"];
const SURNAMES = ["Moyo","Ncube","Sibanda","Dube","Ndlovu","Mpofu","Nyathi","Chikore","Mutasa","Chirwa","Mhlanga","Gumbo","Mapfumo","Chiweshe","Makoni","Mushonga","Marufu","Chinyama","Shumba","Mazarura","Nyamande","Mandaza","Chigumba","Maposa","Tshuma","Mlambo","Khumalo","Hove","Madziva","Zvobgo"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

export function generateDemoSeed(): DemoSeed {
  const rooms: Room[] = ROOM_DEFS.map((r, i) => ({ id: `rm-${i + 1}`, ...r }));

  const subjects: Subject[] = SUBJECT_DEFS.map((s, i) => ({
    id: `sub-${i + 1}`,
    name: s.name,
    color: PALETTE[i % PALETTE.length],
    allowedRoomTypes: s.allowed,
  }));

  // ---- Teachers (20) — @schooldemo.com / Teacher@2025 ----
  const teachers: Teacher[] = [];
  for (let i = 0; i < 20; i++) {
    const isFemale = i % 2 === 0;
    const first = isFemale ? pick(FIRST_F, i + 3) : pick(FIRST_M, i + 1);
    const surname = pick(SURNAMES, i * 3 + 1);
    const title = isFemale ? (i % 4 === 0 ? "Ms." : "Mrs.") : "Mr.";
    teachers.push({
      id: `t-${i + 1}`,
      name: `${title} ${first} ${surname}`,
      email: `${first.toLowerCase().replace(/\s/g,"")}.${surname.toLowerCase().replace(/\s/g,"")}@schooldemo.com`,
      employeeNumber: `T${String(i + 1).padStart(3, "0")}`,
      employmentType: i % 7 === 0 ? "Part-time" : "Full-time",
      maxPeriodsPerWeek: i % 7 === 0 ? 18 : 30,
      preferredTime: "Both",
      qualifiedSubjects: [],
      qualifiedForms: [1, 2, 3, 4, 5, 6],
    });
  }
  subjects.forEach((sub, si) => {
    const t1 = teachers[si % teachers.length];
    const t2 = teachers[(si + 7) % teachers.length];
    if (!t1.qualifiedSubjects.includes(sub.id)) t1.qualifiedSubjects.push(sub.id);
    if (!t2.qualifiedSubjects.includes(sub.id)) t2.qualifiedSubjects.push(sub.id);
  });
  teachers.forEach((t, i) => {
    if (t.qualifiedSubjects.length === 0) t.qualifiedSubjects.push(subjects[i % subjects.length].id);
  });

  // ---- Classes: Form 1A..Form 4B plus Form 5A and Form 6A = 10 classes ----
  const classDefs: Array<{ form: number; stream: "A" | "B" }> = [
    ...[1, 2, 3, 4].flatMap((form) => (["A", "B"] as const).map((stream) => ({ form, stream }))),
    { form: 5, stream: "A" },
    { form: 6, stream: "A" },
  ];
  const classes: SchoolClass[] = classDefs.map(({ form, stream }, i) => {
    const applicableSubjects = SUBJECT_DEFS
      .map((s, idx) => ({ s, id: `sub-${idx + 1}` }))
      .filter(({ s }) => s.forms.includes(form))
      .map(({ s, id: sid }) => ({
        subjectId: sid,
        periodsPerWeek: s.periodsPerWeek,
        roomType: s.allowed[0],
      }));
    return {
      id: `c-${form}${stream}`,
      name: `Form ${form}${stream}`,
      formLevel: form,
      stream,
      studentCount: 15,
      classTeacherId: teachers[i % teachers.length].id,
      subjects: applicableSubjects,
    };
  });

  // ---- Students (10 classes × 15 = 150) ----
  const students: DemoStudent[] = [];
  let sIdx = 0;
  for (const c of classes) {
    for (let n = 0; n < 15; n++) {
      const female = sIdx % 2 === 0;
      const first = female ? pick(FIRST_F, sIdx + 5) : pick(FIRST_M, sIdx + 9);
      const surname = pick(SURNAMES, sIdx * 7 + 11);
      const form = c.formLevel;
      const age = 12 + form;                    // Form 1 ≈ 13 yrs
      const birthYear = new Date().getFullYear() - age;
      const month = ((sIdx * 3) % 12) + 1;
      const day = ((sIdx * 7) % 27) + 1;
      const admissionNumber = `STU${String(sIdx + 1).padStart(4, "0")}`;
      const cleanFirst = first.toLowerCase().replace(/\s/g, "");
      const cleanSurn = surname.toLowerCase().replace(/\s/g, "");
      const email = `${cleanFirst}.${cleanSurn}${sIdx + 1}@student.schooldemo.com`;
      students.push({
        id: `st-${sIdx + 1}`,
        fullName: `${first} ${surname}`,
        dob: `${birthYear}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
        gender: female ? "Female" : "Male",
        admissionNumber,
        form,
        stream: c.stream as "A" | "B",
        classId: c.id,
        email,
        password: "Student@2025",
      });
      sIdx++;
    }
  }

  // ---- Parents (2 per student) ----
  const parents: DemoParent[] = [];
  students.forEach((stu, i) => {
    const surname = stu.fullName.split(" ").slice(-1)[0];
    const father = pick(FIRST_M, i + 4);
    const mother = pick(FIRST_F, i + 6);
    const studentNum = i + 1;
    const cleanSurn = surname.toLowerCase().replace(/\s/g, "");
    // Zimbabwean mobile numbers (Econet 77, NetOne 71).
    parents.push({
      id: `p-${i * 2 + 1}`,
      studentId: stu.id,
      fullName: `${father} ${surname}`,
      relationship: "Father",
      phone: `+26377${1000000 + i}`,
      email: `${father.toLowerCase()}.${cleanSurn}p1.${studentNum}@parent.schooldemo.com`,
      password: "Parent@2025",
    });
    parents.push({
      id: `p-${i * 2 + 2}`,
      studentId: stu.id,
      fullName: `${mother} ${surname}`,
      relationship: "Mother",
      phone: `+26371${2000000 + i}`,
      email: `${mother.toLowerCase()}.${cleanSurn}p2.${studentNum}@parent.schooldemo.com`,
      password: "Parent@2025",
    });
  });

  // ---- Allocations ----
  const allocations: Allocation[] = [];
  for (const c of classes) {
    for (const cs of c.subjects) {
      const qualified = teachers.filter(t => t.qualifiedSubjects.includes(cs.subjectId));
      const teacher = qualified[(parseInt(c.id.replace(/\D/g, "1"), 10) + cs.subjectId.length) % qualified.length] ?? qualified[0];
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

  const studyHall: Subject = { id: "sub-study", name: "Study Hall", color: "hsl(220 15% 60%)", allowedRoomTypes: ["Regular","Library","Hall"] };
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
