import type { Role } from './api/auth';
import type { PublicationType, UserRole } from './workflowTypes';

export const ACTIVE_PUBLICATION_TYPES: PublicationType[] = ['THESIS', 'ARTICLE'];

export function getRoleDisplayLabel(role?: Role | UserRole | null): string {
  switch (role) {
    case 'STUDENT':
      return 'Student';
    case 'LECTURER':
      return 'Lecturer';
    case 'ADMIN':
      return 'Library Administrator';
    default:
      return role
        ? role
          .toLowerCase()
          .split('_')
          .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
          .join(' ')
        : 'Guest';
  }
}

export function formatRoleList(roles: readonly (Role | UserRole)[]): string {
  return roles.map((role) => getRoleDisplayLabel(role)).join(', ');
}
