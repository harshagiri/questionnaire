export const roleHomePath: Record<string, string> = {
  patient: "/patient",
  doctor: "/doctor",
  receptionist: "/receptionist",
  admin: "/admin",
};

export const routeRoleMap: Array<{ prefix: string; role: string }> = [
  { prefix: "/patient", role: "patient" },
  { prefix: "/doctor", role: "doctor" },
  { prefix: "/receptionist", role: "receptionist" },
  { prefix: "/admin", role: "admin" },
];
