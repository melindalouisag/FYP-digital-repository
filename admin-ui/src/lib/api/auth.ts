import { getJson, postJson } from './http';

export type Role = 'STUDENT' | 'LECTURER' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  availableRoles: Role[];
  roleSelectionRequired: boolean;
  profileComplete: boolean;
  emailVerified: boolean;
  name?: string;
  fullName?: string;
  studentId?: string;
  faculty?: string;
  program?: string;
  department?: string;
}

export interface OnboardingPayload {
  name: string;
  faculty: string;
  studyProgram: string;
  studentId?: string;
}

export const authApi = {
  me(): Promise<AuthUser> {
    return getJson<AuthUser>('/api/auth/me');
  },

  logout(): Promise<{ message?: string }> {
    return postJson<{ message?: string }>('/api/auth/logout');
  },

  onboarding(payload: OnboardingPayload): Promise<AuthUser> {
    return postJson<AuthUser>('/api/auth/onboarding', payload);
  },

  selectRole(role: Role): Promise<AuthUser> {
    return postJson<AuthUser>('/api/auth/select-role', { role });
  },
};
