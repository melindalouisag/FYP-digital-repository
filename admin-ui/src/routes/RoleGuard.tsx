import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { defaultPath, type AuthUser } from '../lib/api/auth';

interface RoleGuardProps {
  user: AuthUser | null;
  allowedRoles: Array<'STUDENT' | 'LECTURER' | 'ADMIN'>;
  children: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({ 
  user, 
  allowedRoles, 
  children, 
  redirectTo
}: RoleGuardProps) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.roleSelectionRequired) {
    return <Navigate to="/choose-role" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo ?? defaultPath(user.role)} replace />;
  }

  return <>{children}</>;
}
