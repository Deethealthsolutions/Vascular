// Log-in account roles (app_users.role). The database enforces the same list
// (supabase/migrations/*_app_user_admin.sql).

export const ROLES = [
  { id: "front_office", label: "Front office" },
  { id: "nurse", label: "Nurse" },
  { id: "doctor", label: "Doctor" },
  { id: "research_scientist", label: "Research scientist" },
  { id: "director", label: "Director" },
  { id: "medical_records", label: "Medical record executive" },
  { id: "admin", label: "Admin" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;
export const isAdmin = (a: { role: string } | null | undefined) => a?.role === "admin";
