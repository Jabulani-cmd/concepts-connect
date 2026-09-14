import { z } from "zod";

// Zimbabwean phone: +263XXXXXXXXX or 0XXXXXXXXX (10 digits starting with 0)
export const zimPhoneRegex = /^(\+?263|0)(7[1-8]|8[6-8]|2[0-9])[0-9]{6,7}$/;
export const zimPhoneSchemaRequired = z.string().regex(zimPhoneRegex, "Invalid Zimbabwean phone number (07XXXXXXXX or +2637XXXXXXXX)");
export const zimPhoneSchema = zimPhoneSchemaRequired.or(z.literal(""));

// Back-compat aliases (legacy imports named saPhone*)
export const saPhoneRegex = zimPhoneRegex;
export const saPhoneSchemaRequired = zimPhoneSchemaRequired;
export const saPhoneSchema = zimPhoneSchema;

// Zimbabwean national ID: 63-123456-A-00 (digits/dashes/spaces tolerated)
export const zimNationalIdRegex = /^\d{2}[-\s]?\d{6,7}[-\s]?[A-Za-z][-\s]?\d{2}$/;

export const zimNationalIdSchema = z
  .string()
  .refine((v) => v === "" || zimNationalIdRegex.test(v.trim()), "Invalid national ID (e.g. 63-123456-A-00)")
  .or(z.literal(""));

// Back-compat aliases
export const saIdRegex = zimNationalIdRegex;
export const saIdSchema = zimNationalIdSchema;

export const ZIM_PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands",
] as const;

export const SA_PROVINCES = ZIM_PROVINCES;

export const ZIM_CITIES_BY_PROVINCE: Record<string, string[]> = {
  Harare: ["Harare", "Chitungwiza", "Epworth", "Ruwa", "Norton"],
  Bulawayo: ["Bulawayo"],
  Manicaland: ["Mutare", "Rusape", "Chipinge", "Nyanga"],
  "Mashonaland Central": ["Bindura", "Mount Darwin", "Mvurwi"],
  "Mashonaland East": ["Marondera", "Murehwa", "Mutoko"],
  "Mashonaland West": ["Chinhoyi", "Kariba", "Kadoma", "Chegutu"],
  Masvingo: ["Masvingo", "Chiredzi", "Triangle"],
  "Matabeleland North": ["Hwange", "Victoria Falls", "Lupane"],
  "Matabeleland South": ["Gwanda", "Beitbridge", "Plumtree"],
  Midlands: ["Gweru", "Kwekwe", "Zvishavane", "Shurugwi"],
};

export const SA_CITIES_BY_PROVINCE = ZIM_CITIES_BY_PROVINCE;

export const ZIM_CITIES = Object.values(ZIM_CITIES_BY_PROVINCE).flat();
export const SA_CITIES = ZIM_CITIES;


export const studentFormSchema = z.object({
  admission_number: z.string().optional().default(""),
  full_name: z.string().min(2, "Full name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  form: z.string().min(1, "Grade is required"),
  stream: z.string().optional(),
  subject_combination: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  guardian_name: z.string().min(2, "Guardian name is required"),
  guardian_phone: saPhoneSchemaRequired,
  guardian_email: z.string().email("Invalid email").min(1, "Guardian email is required"),
  emergency_contact: saPhoneSchemaRequired,
  medical_conditions: z.string().optional(),
  has_medical_alert: z.boolean().default(false),
  address: z.string().min(5, "Address is required"),
  province: z.string().optional(),
  enrollment_date: z.string().min(1, "Enrollment date is required"),
  status: z.string().default("active"),
  sports_activities: z.array(z.string()).optional().default([]),
  boarding_status: z.string().default("day"),
});

export const staffFormSchema = z.object({
  staff_number: z.string().optional(),
  full_name: z.string().min(2, "Full name is required"),
  role: z.string().default("teacher"),
  department: z.string().optional(),
  subjects_taught: z.array(z.string()).optional(),
  phone: saPhoneSchema.optional().or(z.literal("")),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().optional(),
  emergency_contact: saPhoneSchema.optional().or(z.literal("")),
  employment_date: z.string().optional(),
  qualifications: z.string().optional(),
  sars_number: z.string().optional(),      // SARS tax number (was PAYE)
  uif_number: z.string().optional(),       // UIF number (was NSSA)
  bank_details: z.string().optional(),
  national_id: saIdSchema.optional().or(z.literal("")),
  status: z.string().default("active"),
  category: z.string().default("teaching"),
  title: z.string().optional(),
  bio: z.string().optional(),
});

export type StudentFormData = z.infer<typeof studentFormSchema>;
export type StaffFormData = z.infer<typeof staffFormSchema>;
