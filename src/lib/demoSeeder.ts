// Demo data seeder — generates a complete realistic South African high school dataset
// (Grades 8–12, CAPS curriculum, ZAR fees, +27 phone numbers).
import type {
  Teacher, Subject, Room, SchoolClass, Allocation, TimetableSlot, RoomType,
} from "@/contexts/AllocationContext";

export interface DemoStudent {
  id: string;
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  admissionNumber: string;
  grade: number;          // 8–12
  form: number;           // legacy alias === grade (kept for backwards compat with existing UI)
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

// SA-style school day (07:30–14:15), 8×45min periods, break after P3, lunch after P5.
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

// CAPS-aligned subject catalogue (SA high school, Grades 8–12).
const SUBJECT_DEFS: Array<{ name: string; allowed: RoomType[]; grades: number[]; periodsPerWeek: number }> = [
  { name: "Mathematics",            allowed: ["Regular"],                    grades: [8,9,10,11,12], periodsPerWeek: 6 },
  { name: "English Home Language",  allowed: ["Regular"],                    grades: [8,9,10,11,12], periodsPerWeek: 5 },
  { name: "Afrikaans FAL",          allowed: ["Regular"],                    grades: [8,9,10,11,12], periodsPerWeek: 4 },
  { name: "Life Orientation",       allowed: ["Regular"],                    grades: [8,9,10,11,12], periodsPerWeek: 2 },
  { name: "Natural Sciences",       allowed: ["Lab"],                        grades: [8,9],          periodsPerWeek: 4 },
  { name: "Physical Sciences",      allowed: ["Lab"],                        grades: [10,11,12],     periodsPerWeek: 5 },
  { name: "Life Sciences",          allowed: ["Lab"],                        grades: [10,11,12],     periodsPerWeek: 4 },
  { name: "Social Sciences",        allowed: ["Regular"],                    grades: [8,9],          periodsPerWeek: 3 },
  { name: "History",                allowed: ["Regular"],                    grades: [10,11,12],     periodsPerWeek: 3 },
  { name: "Geography",              allowed: ["Regular"],                    grades: [10,11,12],     periodsPerWeek: 3 },
  { name: "Economic & Management Sciences", allowed: ["Regular"],            grades: [8,9],          periodsPerWeek: 3 },
  { name: "Accounting",             allowed: ["Regular"],                    grades: [10,11,12],     periodsPerWeek: 4 },
  { name: "Business Studies",       allowed: ["Regular"],                    grades: [10,11,12],     periodsPerWeek: 3 },
  { name: "Computer Applications Technology", allowed: ["Computer Room"],    grades: [8,9,10,11,12], periodsPerWeek: 3 },
  { name: "Physical Education",     allowed: ["Hall","Sports Field"],        grades: [8,9,10,11,12], periodsPerWeek: 2 },
  { name: "Creative Arts",          allowed: ["Regular"],                    grades: [8,9],          periodsPerWeek: 2 },
];

const ROOM_DEFS: Array<{ name: string; type: RoomType; capacity: number }> = [
  ...Array.from({ length: 12 }, (_, i) => ({ name: `Room ${i + 1}`, type: "Regular" as RoomType, capacity: 40 })),
  { name: "Science Lab A",    type: "Lab",           capacity: 32 },
  { name: "Science Lab B",    type: "Lab",           capacity: 32 },
  { name: "Computer Lab",     type: "Computer Room", capacity: 30 },
  { name: "Art Room",         type: "Regular",       capacity: 28 },
  { name: "Life Sciences Room", type: "Regular",     capacity: 30 },
  { name: "School Hall",      type: "Hall",          capacity: 250 },
  { name: "Sports Field",     type: "Sports Field",  capacity: 200 },
  { name: "Library",          type: "Library",       capacity: 60 },
];

// Representative South African name pools (multi-cultural).
const SA_FIRST_M = ["Sipho","Bongani","Mandla","Sizwe","Themba","Musa","Andile","Ayanda","Lwazi","Sifiso","Sanele","Nkosinathi","Njabulo","Mfundo","Mthobisi","Zweli","Menzi","Bhekani","Sabelo","Siyabonga","Thulani","Nhlanhla","Xolani","Lindani","Mpho","Vusi"];
const SA_FIRST_F = ["Nomvula","Thandi","Zanele","Nokuthula","Nomsa","Ntombi","Sibongile","Sindisiwe","Nonhlanhla","Busisiwe","Zinhle","Londiwe","Nokwanda","Slindile","Philisiwe","Thembeka","Nomthandazo","Bongiwe","Fikile","Nozipho","Lungile","Nomfundo","Thulisile","Snenhlanhla"];
const SA_SURNAMES = ["Zulu","Ndlovu","Khumalo","Dlamini","Mthembu","Ngcobo","Buthelezi","Nkosi","Mkhize","Cele","Sithole","Zwane","Hlongwane","Mabaso","Zondi","Gumede","Mnguni","Shabalala","Ngema","Ntuli","Xaba","Mhlongo","Nzuza","Mchunu","Madlala","Shezi","Mtshali","Mazibuko","Nxumalo","Biyela"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

export function generateDemoSeed(): DemoSeed {
  const rooms: Room[] = ROOM_DEFS.map((r, i) => ({ id: `rm-${i + 1}`, ...r }));

  const subjects: Subject[] = SUBJECT_DEFS.map((s, i) => ({
    id: `sub-${i + 1}`,
    name: s.name,
    color: PALETTE[i % PALETTE.length],
    allowedRoomTypes: s.allowed,
  }));

  // ---- Teachers (20) — SA names, @schooldemo.com / Teacher@2025 ----
  const teachers: Teacher[] = [];
  for (let i = 0; i < 20; i++) {
    const isFemale = i % 2 === 0;
    const first = isFemale ? pick(SA_FIRST_F, i + 3) : pick(SA_FIRST_M, i + 1);
    const surname = pick(SA_SURNAMES, i * 3 + 1);
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
      qualifiedGrades: [8, 9, 10, 11, 12],
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

  // ---- Classes: Grade 8A..12B = 10 classes ----
  const classes: SchoolClass[] = [];
  for (let grade = 8; grade <= 12; grade++) {
    for (const stream of ["A", "B"] as const) {
      const id = `c-${grade}${stream}`;
      const classTeacher = teachers[((grade - 8) * 2 + (stream === "A" ? 0 : 1)) % teachers.length];
      const applicableSubjects = SUBJECT_DEFS
        .map((s, idx) => ({ s, id: `sub-${idx + 1}` }))
        .filter(({ s }) => s.grades.includes(grade))
        .map(({ s, id: sid }) => ({
          subjectId: sid,
          periodsPerWeek: s.periodsPerWeek,
          roomType: s.allowed[0],
        }));
      classes.push({
        id,
        name: `Grade ${grade}${stream}`,
        gradeLevel: grade,
        stream,
        studentCount: 15,
        classTeacherId: classTeacher.id,
        subjects: applicableSubjects,
      });
    }
  }

  // ---- Students (10 classes × 15 = 150) ----
  const students: DemoStudent[] = [];
  let sIdx = 0;
  for (const c of classes) {
    for (let n = 0; n < 15; n++) {
      const female = sIdx % 2 === 0;
      const first = female ? pick(SA_FIRST_F, sIdx + 5) : pick(SA_FIRST_M, sIdx + 9);
      const surname = pick(SA_SURNAMES, sIdx * 7 + 11);
      const grade = c.gradeLevel;
      const age = 5 + grade;                    // Grade 8 ≈ 13 yrs
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
        grade,
        form: grade,          // legacy alias
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
    const father = pick(SA_FIRST_M, i + 4);
    const mother = pick(SA_FIRST_F, i + 6);
    const studentNum = i + 1;
    const cleanSurn = surname.toLowerCase().replace(/\s/g, "");
    // SA mobile numbers: +27 6X/7X/8X ...
    parents.push({
      id: `p-${i * 2 + 1}`,
      studentId: stu.id,
      fullName: `${father} ${surname}`,
      relationship: "Father",
      phone: `+27 82 ${String(1000000 + i).slice(1, 4)} ${String(1000000 + i).slice(4, 8)}`,
      email: `${father.toLowerCase()}.${cleanSurn}p1.${studentNum}@parent.schooldemo.com`,
      password: "Parent@2025",
    });
    parents.push({
      id: `p-${i * 2 + 2}`,
      studentId: stu.id,
      fullName: `${mother} ${surname}`,
      relationship: "Mother",
      phone: `+27 83 ${String(2000000 + i).slice(1, 4)} ${String(2000000 + i).slice(4, 8)}`,
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
