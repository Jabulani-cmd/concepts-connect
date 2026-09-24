/** Each role's home page in the portal. */
export const PORTAL_HOME: Record<string, string> = {
  student: "/portal/student",
  teacher: "/portal/teacher",
  parent: "/portal/parent-teacher",
  admin: "/portal/admin",
  finance: "/portal/finance",
  finance_clerk: "/portal/finance",
  bursar: "/portal/finance",
  principal: "/portal/principal",
  deputy_principal: "/portal/deputy-principal",
  hod: "/portal/hod",
  admin_supervisor: "/portal/admin-supervisor",
  registration: "/portal/registration",
};

export const portalHomeFor = (role: string | null | undefined): string => (role && PORTAL_HOME[role]) || "/login";
