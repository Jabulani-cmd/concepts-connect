import { supabase } from "@/integrations/supabase/client";

/**
 * Staff columns any school staff member may read. National ID, NSSA/PAYE numbers,
 * bank details, address and emergency contact are not readable directly; they come
 * from `get_staff_private`, which returns them only to administrators and to the
 * staff member themself.
 */
export const STAFF_COLUMNS =
  "id, staff_number, user_id, full_name, title, department, category, email, phone, bio, photo_url, qualifications, date_joined, status, created_at, updated_at, role, employment_date, subjects_taught" as const;

export type StaffPrivate = {
  national_id: string | null;
  nssa_number: string | null;
  paye_number: string | null;
  bank_details: string | null;
  address: string | null;
  emergency_contact: string | null;
};

const EMPTY_PRIVATE: StaffPrivate = {
  national_id: null, nssa_number: null, paye_number: null, bank_details: null, address: null, emergency_contact: null,
};

/** Adds the private fields the signed-in user is allowed to see (blank otherwise). */
export async function withStaffPrivate<T extends { id: string }>(rows: T[]): Promise<(T & StaffPrivate)[]> {
  if (!rows.length) return [];
  const { data } = await supabase.rpc("get_staff_private", { _staff_ids: rows.map((r) => r.id) });
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.id);
    return {
      ...r,
      ...EMPTY_PRIVATE,
      ...(p && {
        national_id: p.national_id, nssa_number: p.nssa_number, paye_number: p.paye_number,
        bank_details: p.bank_details, address: p.address, emergency_contact: p.emergency_contact,
      }),
    };
  });
}

/** HR fields that live in staff_private rather than on the staff row. */
export const STAFF_PRIVATE_KEYS = ["national_id", "nssa_number", "paye_number", "bank_details", "address", "emergency_contact"] as const;

/** Splits a staff form payload into the staff row and its private HR fields. */
export function splitStaffPrivate<T extends Record<string, unknown>>(payload: T): {
  staff: Omit<T, (typeof STAFF_PRIVATE_KEYS)[number]>;
  hr: Partial<StaffPrivate>;
} {
  const staff: Record<string, unknown> = { ...payload };
  const hr: Partial<StaffPrivate> = {};
  for (const key of STAFF_PRIVATE_KEYS) {
    if (key in staff) {
      hr[key] = (staff[key] as string | null) ?? null;
      delete staff[key];
    }
  }
  return { staff: staff as Omit<T, (typeof STAFF_PRIVATE_KEYS)[number]>, hr };
}

/** Saves HR fields for one staff member (administrators only; the database refuses anyone else). */
export async function saveStaffPrivate(staffId: string, hr: Partial<StaffPrivate>): Promise<void> {
  if (!Object.keys(hr).length) return;
  const { error } = await supabase
    .from("staff_private")
    .upsert({ staff_id: staffId, ...hr, updated_at: new Date().toISOString() }, { onConflict: "staff_id" });
  if (error) throw error;
}
