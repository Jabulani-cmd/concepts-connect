// Demo data seeder — generates a complete, realistic Zimbabwean secondary school:
// 500 students in Forms 1–6, their parents/guardians, teachers, classes, ZIMSEC
// O-Level and A-Level subjects and a solved weekly timetable. Deterministic, so
// every run produces the same people and the same logins.
import type {
  Teacher, Subject, Room, SchoolClass, Allocation, TimetableSlot, RoomType,
} from "@/contexts/AllocationContext";

export const DEMO_EMAIL_DOMAIN = "schooldemo.com";
export const DEMO_PASSWORDS = {
  admin: "Demo@2025",
  teacher: "Teacher@2025",
  student: "Student@2025",
  parent: "Parent@2025",
} as const;

export interface DemoStudent {
  id: string;
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  admissionNumber: string;
  form: number;           // 1–6
  stream: string;         // "A", "B", "C"
  classId: string;
  familyId: string;
  province: string;
  address: string;
  boarding: boolean;
  email: string;
  password: string;
}

export interface DemoParent {
  id: string;
  familyId: string;
  /** Every child of this parent in the school (siblings share their parents' logins). */
  childIds: string[];
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
  "hsl(100 60% 45%)","hsl(340 70% 55%)","hsl(50 80% 50%)","hsl(230 60% 55%)",
  "hsl(160 60% 40%)","hsl(300 50% 55%)","hsl(35 85% 50%)","hsl(210 30% 50%)",
];

// ---- School structure: 500 students ----
// Forms 1–4: three streams (A, B, C) of 35 = 420 O-Level students.
// Forms 5–6: Sciences (A) and Commercials (B) streams of 20 = 80 A-Level students.
const CLASS_DEFS: Array<{ form: number; stream: string; size: number; label?: string }> = [
  ...[1, 2, 3, 4].flatMap((form) => ["A", "B", "C"].map((stream) => ({ form, stream, size: 35 }))),
  ...[5, 6].flatMap((form) => [
    { form, stream: "A", size: 20, label: "Sciences" },
    { form, stream: "B", size: 20, label: "Commercials" },
  ]),
];
export const DEMO_STUDENT_COUNT = CLASS_DEFS.reduce((n, c) => n + c.size, 0);

// ZIMSEC subject catalogue. `streams` limits an A-Level subject to one sixth-form stream.
const O_LEVEL = [1, 2, 3, 4];
const A_LEVEL = [5, 6];
const ALL_FORMS = [...O_LEVEL, ...A_LEVEL];
type SubjectDef = { name: string; allowed: RoomType[]; forms: number[]; streams?: string[]; periodsPerWeek: number };
const SUBJECT_DEFS: SubjectDef[] = [
  { name: "Mathematics",              allowed: ["Regular"],              forms: O_LEVEL, periodsPerWeek: 6 },
  { name: "English Language",         allowed: ["Regular"],              forms: O_LEVEL, periodsPerWeek: 5 },
  { name: "Shona",                    allowed: ["Regular"],              forms: O_LEVEL, periodsPerWeek: 4 },
  { name: "Combined Science",         allowed: ["Lab"],                  forms: O_LEVEL, periodsPerWeek: 5 },
  { name: "Heritage Studies",         allowed: ["Regular"],              forms: [1, 2], periodsPerWeek: 2 },
  { name: "History",                  allowed: ["Regular"],              forms: O_LEVEL, periodsPerWeek: 3 },
  { name: "Geography",                allowed: ["Regular"],              forms: ALL_FORMS, streams: ["B"], periodsPerWeek: 3 },
  { name: "Agriculture",              allowed: ["Regular"],              forms: [1, 2], periodsPerWeek: 3 },
  { name: "Principles of Accounting", allowed: ["Regular"],              forms: [3, 4], periodsPerWeek: 4 },
  { name: "Commerce",                 allowed: ["Regular"],              forms: [3, 4], periodsPerWeek: 3 },
  { name: "Computer Science",         allowed: ["Computer Room"],        forms: ALL_FORMS, periodsPerWeek: 3 },
  { name: "Physical Education",       allowed: ["Hall", "Sports Field"], forms: ALL_FORMS, periodsPerWeek: 2 },
  { name: "Pure Mathematics",         allowed: ["Regular"],              forms: A_LEVEL, streams: ["A"], periodsPerWeek: 6 },
  { name: "Physics",                  allowed: ["Lab"],                  forms: A_LEVEL, streams: ["A"], periodsPerWeek: 5 },
  { name: "Chemistry",                allowed: ["Lab"],                  forms: A_LEVEL, streams: ["A"], periodsPerWeek: 5 },
  { name: "Biology",                  allowed: ["Lab"],                  forms: A_LEVEL, streams: ["A"], periodsPerWeek: 5 },
  { name: "Accounting",               allowed: ["Regular"],              forms: A_LEVEL, streams: ["B"], periodsPerWeek: 5 },
  { name: "Business Studies",         allowed: ["Regular"],              forms: A_LEVEL, streams: ["B"], periodsPerWeek: 5 },
  { name: "Economics",                allowed: ["Regular"],              forms: A_LEVEL, streams: ["B"], periodsPerWeek: 5 },
];
// Stream limits only apply in the sixth form; every O-Level class takes all of its form's subjects.
const takesSubject = (def: SubjectDef, form: number, stream: string) =>
  def.forms.includes(form) && (!def.streams || form <= 4 || def.streams.includes(stream));

const ROOM_DEFS: Array<{ name: string; type: RoomType; capacity: number }> = [
  ...Array.from({ length: 18 }, (_, i) => ({ name: `Room ${i + 1}`, type: "Regular" as RoomType, capacity: 40 })),
  { name: "Science Lab 1",    type: "Lab",           capacity: 36 },
  { name: "Science Lab 2",    type: "Lab",           capacity: 36 },
  { name: "Science Lab 3",    type: "Lab",           capacity: 36 },
  { name: "Science Lab 4",    type: "Lab",           capacity: 36 },
  { name: "Computer Lab 1",   type: "Computer Room", capacity: 36 },
  { name: "Computer Lab 2",   type: "Computer Room", capacity: 36 },
  { name: "School Hall",      type: "Hall",          capacity: 500 },
  { name: "Sports Field",     type: "Sports Field",  capacity: 300 },
  { name: "Library",          type: "Library",       capacity: 80 },
];

// Shona and Ndebele name pools.
const FIRST_M = ["Tatenda","Tinashe","Farai","Tafadzwa","Kudakwashe","Takudzwa","Tapiwa","Simbarashe","Tendai","Munyaradzi","Tawanda","Ngonidzashe","Anesu","Panashe","Nkosana","Mthokozisi","Sibusiso","Bekezela","Lwazi","Thabani","Nqobile","Mandla","Kundai","Tonderai","Blessing","Brighton","Tanatswa","Ropafadzo","Kupakwashe","Tadiwa","Makanaka","Mufaro","Nyasha","Takunda","Tinotenda","Vusumuzi","Bongani","Sipho","Themba","Lungelo","Mluleki","Donald","Tichaona","Wellington","Innocent","Prosper","Clever","Godknows"];
const FIRST_F = ["Ruvimbo","Rutendo","Chiedza","Tsitsi","Rumbidzai","Vimbai","Tariro","Chipo","Fadzai","Tanaka","Kudzai","Rufaro","Shamiso","Nokuthula","Sibongile","Thandeka","Nomalanga","Busisiwe","Sithabile","Zanele","Precious","Memory","Nyasha","Tatenda","Anotidaishe","Mitchell","Ropafadzo","Kupakwashe","Nokutenda","Tadiwanashe","Munashe","Nkazimulo","Sinqobile","Ntombizodwa","Thulisile","Nomvula","Mazvita","Chengetai","Rudo","Tendai","Petronella","Charity","Patience","Loveness","Gugulethu","Nothando","Samkeliso","Ashley"];
const SURNAMES = ["Moyo","Ncube","Sibanda","Dube","Ndlovu","Mpofu","Nyathi","Chikore","Mutasa","Chirwa","Mhlanga","Gumbo","Mapfumo","Chiweshe","Makoni","Mushonga","Marufu","Chinyama","Shumba","Mazarura","Nyamande","Mandaza","Chigumba","Maposa","Tshuma","Mlambo","Khumalo","Hove","Madziva","Zvobgo","Musonza","Chidziva","Mawere","Nhamo","Gwaze","Chakanyuka","Mukanya","Mudzingwa","Sithole","Mabhena","Dlodlo","Masuku","Nkomo","Mafu","Moyana","Chinembiri","Zulu","Mangwiro","Mupfumira","Takawira","Chimuka","Makwara","Munemo","Rusike","Kanengoni","Muchena","Mhike","Zimuto","Machingura","Chipunza"];
const PROVINCES: Array<{ province: string; suburbs: string[] }> = [
  { province: "Harare",              suburbs: ["Avondale", "Borrowdale", "Mabelreign", "Greendale", "Hatfield", "Kuwadzana", "Warren Park", "Highfield", "Mount Pleasant", "Waterfalls"] },
  { province: "Harare",              suburbs: ["Chitungwiza", "Epworth", "Ruwa", "Norton", "Marlborough", "Belvedere"] },
  { province: "Mashonaland East",    suburbs: ["Marondera", "Murehwa", "Goromonzi"] },
  { province: "Mashonaland West",    suburbs: ["Chinhoyi", "Chegutu", "Kadoma"] },
  { province: "Mashonaland Central", suburbs: ["Bindura", "Mazowe"] },
  { province: "Manicaland",          suburbs: ["Mutare", "Rusape"] },
  { province: "Midlands",            suburbs: ["Gweru", "Kwekwe"] },
  { province: "Bulawayo",            suburbs: ["Suburbs", "Hillside", "Nkulumane"] },
  { province: "Masvingo",            suburbs: ["Masvingo"] },
];

function pick<T>(arr: readonly T[], i: number): T { return arr[((i % arr.length) + arr.length) % arr.length]; }
const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function generateDemoSeed(): DemoSeed {
  const rooms: Room[] = ROOM_DEFS.map((r, i) => ({ id: `rm-${i + 1}`, ...r }));
  const subjects: Subject[] = SUBJECT_DEFS.map((s, i) => ({
    id: `sub-${i + 1}`,
    name: s.name,
    color: PALETTE[i % PALETTE.length],
    allowedRoomTypes: s.allowed,
  }));
  const subjectIdOf = (name: string) => subjects.find((s) => s.name === name)!.id;

  // ---- Classes ----
  const classes: SchoolClass[] = CLASS_DEFS.map(({ form, stream, size, label }) => ({
    id: `c-${form}${stream}`,
    name: `Form ${form}${stream}`,
    formLevel: form,
    stream: label ?? stream,
    studentCount: size,
    subjects: SUBJECT_DEFS
      .filter((def) => takesSubject(def, form, stream))
      .map((def) => ({ subjectId: subjectIdOf(def.name), periodsPerWeek: def.periodsPerWeek, roomType: def.allowed[0] })),
  }));
  const streamLetter = (c: SchoolClass) => c.name.slice(-1);

  // ---- Teachers: enough qualified staff to cover every subject's weekly periods ----
  const MAX_LOAD = 28;
  const demand = new Map<string, number>();
  for (const c of classes) for (const cs of c.subjects) demand.set(cs.subjectId, (demand.get(cs.subjectId) ?? 0) + cs.periodsPerWeek);
  const teachers: Teacher[] = [];
  const usedEmails = new Set<string>();
  const newTeacher = (): Teacher => {
    const i = teachers.length;
    const female = i % 2 === 0;
    const first = female ? pick(FIRST_F, i * 5 + 2) : pick(FIRST_M, i * 5 + 1);
    const surname = pick(SURNAMES, i * 7 + 3);
    const title = female ? (i % 4 === 0 ? "Ms." : "Mrs.") : "Mr.";
    let email = `${clean(first)}.${clean(surname)}@${DEMO_EMAIL_DOMAIN}`;
    for (let n = 2; usedEmails.has(email); n++) email = `${clean(first)}.${clean(surname)}${n}@${DEMO_EMAIL_DOMAIN}`;
    usedEmails.add(email);
    const t: Teacher = {
      id: `t-${i + 1}`,
      name: `${title} ${first} ${surname}`,
      email,
      employeeNumber: `T${String(i + 1).padStart(3, "0")}`,
      employmentType: i % 9 === 8 ? "Part-time" : "Full-time",
      maxPeriodsPerWeek: i % 9 === 8 ? 18 : MAX_LOAD,
      preferredTime: "Both",
      qualifiedSubjects: [],
      qualifiedForms: [],
    };
    teachers.push(t);
    return t;
  };
  // Each subject gets ceil(demand / 24) specialists, so no teacher is booked beyond ~24 periods.
  for (const [subjectId, periods] of [...demand.entries()].sort((a, b) => b[1] - a[1])) {
    const needed = Math.max(1, Math.ceil(periods / 24));
    for (let k = 0; k < needed; k++) {
      const t = newTeacher();
      t.qualifiedSubjects.push(subjectId);
    }
  }
  // A second, lighter subject for every teacher (shared across departments) adds cover.
  teachers.forEach((t, i) => {
    const second = subjects[(i * 3 + 5) % subjects.length].id;
    if (!t.qualifiedSubjects.includes(second)) t.qualifiedSubjects.push(second);
  });
  for (const t of teachers) {
    t.qualifiedForms = [...new Set(classes.filter((c) => c.subjects.some((cs) => t.qualifiedSubjects.includes(cs.subjectId))).map((c) => c.formLevel))].sort();
  }

  // ---- Allocations: each class/subject goes to the least-loaded qualified teacher ----
  const load = new Map<string, number>(teachers.map((t) => [t.id, 0]));
  const allocations: Allocation[] = [];
  for (const c of classes) {
    for (const cs of c.subjects) {
      const qualified = teachers.filter((t) => t.qualifiedSubjects[0] === cs.subjectId);
      const pool = qualified.length ? qualified : teachers.filter((t) => t.qualifiedSubjects.includes(cs.subjectId));
      const teacher = pool.reduce((best, t) => (load.get(t.id)! < load.get(best.id)! ? t : best), pool[0]);
      load.set(teacher.id, load.get(teacher.id)! + cs.periodsPerWeek);
      allocations.push({ id: `a-${c.id}-${cs.subjectId}`, classId: c.id, subjectId: cs.subjectId, teacherId: teacher.id, periodsPerWeek: cs.periodsPerWeek });
    }
  }
  // Class teacher: whoever teaches the class the most periods.
  for (const c of classes) {
    const mine = allocations.filter((a) => a.classId === c.id).sort((a, b) => b.periodsPerWeek - a.periodsPerWeek);
    c.classTeacherId = mine[0]?.teacherId;
  }

  // ---- Families and students ----
  // Seats are dealt round-robin across classes so siblings land in different classes.
  const seats: SchoolClass[] = [];
  const remaining = new Map(classes.map((c) => [c.id, c.studentCount]));
  while (seats.length < DEMO_STUDENT_COUNT) {
    for (const c of classes) {
      if (remaining.get(c.id)! > 0) { seats.push(c); remaining.set(c.id, remaining.get(c.id)! - 1); }
    }
  }
  const students: DemoStudent[] = [];
  const parents: DemoParent[] = [];
  const year = new Date().getFullYear();
  let familyIdx = 0;
  while (students.length < seats.length) {
    const familyId = `f-${familyIdx + 1}`;
    const surname = pick(SURNAMES, familyIdx * 11 + 7);
    const home = pick(PROVINCES, familyIdx * 3);
    const suburb = pick(home.suburbs, familyIdx);
    // Roughly one family in six has two children at the school.
    const kids = familyIdx % 6 === 5 ? 2 : 1;
    const childIds: string[] = [];
    for (let k = 0; k < kids && students.length < seats.length; k++) {
      const n = students.length;
      const c = seats[n];
      const female = (n + k) % 2 === 0;
      const first = female ? pick(FIRST_F, n * 7 + 3) : pick(FIRST_M, n * 5 + 11);
      const age = 12 + c.formLevel;              // Form 1 ≈ 13 years old
      const month = ((n * 5) % 12) + 1;
      const day = ((n * 7) % 27) + 1;
      const id = `st-${n + 1}`;
      students.push({
        id,
        fullName: `${first} ${surname}`,
        dob: `${year - age}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        gender: female ? "Female" : "Male",
        admissionNumber: `STU${String(n + 1).padStart(4, "0")}`,
        form: c.formLevel,
        stream: streamLetter(c),
        classId: c.id,
        familyId,
        province: home.province,
        address: `${100 + ((n * 37) % 900)} ${pick(["Samora Machel Ave", "Herbert Chitepo St", "Josiah Tongogara Ave", "Nelson Mandela Ave", "Leopold Takawira St", "Kwame Nkrumah Ave", "Enterprise Rd", "Churchill Ave"], n)}, ${suburb}`,
        boarding: n % 5 === 0,
        email: `${clean(first)}.${clean(surname)}${n + 1}@student.${DEMO_EMAIL_DOMAIN}`,
        password: DEMO_PASSWORDS.student,
      });
      childIds.push(id);
    }
    // Each family has a mother and a father login; one in ten has a single guardian instead.
    // Siblings share their parents' logins.
    const roles: DemoParent["relationship"][] = familyIdx % 10 === 9 ? ["Guardian"] : ["Mother", "Father"];
    roles.forEach((relationship, r) => {
      const parentFirst = relationship === "Father" ? pick(FIRST_M, familyIdx * 3 + 17) : pick(FIRST_F, familyIdx * 3 + 19);
      const title = relationship === "Father" ? "Mr." : relationship === "Mother" ? "Mrs." : "Ms.";
      parents.push({
        id: `p-${parents.length + 1}`,
        familyId,
        childIds,
        fullName: `${title} ${parentFirst} ${surname}`,
        relationship,
        // Zimbabwean mobile numbers: Econet 077/078, NetOne 071.
        phone: `+263${pick(["77", "78", "71"], familyIdx + r)}${1000000 + familyIdx * 2 + r}`,
        email: `${clean(parentFirst)}.${clean(surname)}.p${parents.length + 1}@parent.${DEMO_EMAIL_DOMAIN}`,
        password: DEMO_PASSWORDS.parent,
      });
    });
    familyIdx++;
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
  // Scarce rooms (labs, computer rooms) first, then the subjects with the most periods.
  const scarcity = (a: Allocation) => rooms.filter((r) => subjects.find((x) => x.id === a.subjectId)!.allowedRoomTypes.includes(r.type)).length;
  const ordered = [...allocations].sort((x, y) => scarcity(x) - scarcity(y) || y.periodsPerWeek - x.periodsPerWeek);
  const classIndex = new Map(classes.map((c, i) => [c.id, i]));

  for (const alloc of ordered) {
    const sub = subjects.find((x) => x.id === alloc.subjectId)!;
    const candidateRooms = rooms.filter((r) => sub.allowedRoomTypes.includes(r.type));
    const classSlots = slots.filter((x) => x.classId === alloc.classId);
    const perDay = [0, 0, 0, 0, 0];
    const dailyCap = Math.ceil(alloc.periodsPerWeek / 5);
    const shift = (classIndex.get(alloc.classId)! + alloc.subjectId.length) % 5;

    const tryPlace = (cap: number) => {
      // Least-used days first, rotated per class so subjects don't all start on Monday.
      const days = [0, 1, 2, 3, 4]
        .map((d) => (d + shift) % 5)
        .filter((d) => perDay[d] < cap)
        .sort((x, y) => perDay[x] - perDay[y]);
      for (const day of days) {
        const open = classSlots
          .filter((x) => x.day === day && !x.subjectId)
          .sort((x, y) => ((x.period + shift) % 8) - ((y.period + shift) % 8));
        for (const slot of open) {
          const tKey = `${slot.day}-${slot.period}-${alloc.teacherId}`;
          if (teacherBusy.has(tKey)) continue;
          const room = candidateRooms.find((r) => !roomBusy.has(`${slot.day}-${slot.period}-${r.id}`));
          if (!room) continue;
          slot.subjectId = alloc.subjectId;
          slot.teacherId = alloc.teacherId;
          slot.roomId = room.id;
          teacherBusy.add(tKey);
          roomBusy.add(`${slot.day}-${slot.period}-${room.id}`);
          perDay[day]++;
          return true;
        }
      }
      return false;
    };

    for (let n = 0; n < alloc.periodsPerWeek; n++) {
      // Spread evenly first; only double up on a day when the week is otherwise full.
      if (!tryPlace(dailyCap) && !tryPlace(dailyCap + 1)) tryPlace(8);
    }
  }

  // Repair: a lesson that found no slot takes one from another lesson in the same class,
  // which moves to a free period where its own teacher and a suitable room are available.
  const roomsFor = (subjectId: string) => rooms.filter((r) => subjects.find((x) => x.id === subjectId)!.allowedRoomTypes.includes(r.type));
  const freeRoom = (subjectId: string, day: number, period: number, alsoFree?: string) =>
    roomsFor(subjectId).find((r) => r.id === alsoFree || !roomBusy.has(`${day}-${period}-${r.id}`));
  for (const alloc of allocations) {
    const classSlots = slots.filter((x) => x.classId === alloc.classId);
    let missing = alloc.periodsPerWeek - classSlots.filter((x) => x.subjectId === alloc.subjectId).length;
    for (const target of classSlots) {
      if (missing <= 0) break;
      if (!target.subjectId || target.subjectId === alloc.subjectId) continue;
      if (teacherBusy.has(`${target.day}-${target.period}-${alloc.teacherId}`)) continue;
      const myRoom = freeRoom(alloc.subjectId, target.day, target.period, target.roomId);
      if (!myRoom) continue;
      const dest = classSlots.find((f) =>
        !f.subjectId &&
        !teacherBusy.has(`${f.day}-${f.period}-${target.teacherId}`) &&
        freeRoom(target.subjectId!, f.day, f.period));
      if (!dest) continue;
      // Move the displaced lesson to the free period.
      const destRoom = freeRoom(target.subjectId, dest.day, dest.period)!;
      teacherBusy.delete(`${target.day}-${target.period}-${target.teacherId}`);
      roomBusy.delete(`${target.day}-${target.period}-${target.roomId}`);
      Object.assign(dest, { subjectId: target.subjectId, teacherId: target.teacherId, roomId: destRoom.id });
      teacherBusy.add(`${dest.day}-${dest.period}-${dest.teacherId}`);
      roomBusy.add(`${dest.day}-${dest.period}-${destRoom.id}`);
      // Put the missing lesson where it was.
      Object.assign(target, { subjectId: alloc.subjectId, teacherId: alloc.teacherId, roomId: myRoom.id });
      teacherBusy.add(`${target.day}-${target.period}-${alloc.teacherId}`);
      roomBusy.add(`${target.day}-${target.period}-${myRoom.id}`);
      missing--;
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
