import type { Role } from "./api/auth";

export function defaultPath(role: Role | string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "LECTURER") return "/lecturer/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/";
}
