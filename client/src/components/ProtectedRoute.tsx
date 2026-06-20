import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useRole } from '../hooks/useRole';
import type { Role } from '../context/RoleContext';

interface ProtectedRouteProps {
  roles: Role[];
  children: ReactNode;
}

/** Redirects to / if the active role is not in the allowed roles list. */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { role } = useRole();
  if (!roles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
