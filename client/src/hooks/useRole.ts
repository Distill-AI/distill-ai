import { useContext } from 'react';
import { RoleContext } from '../context/RoleContext';
import type { Role } from '../context/RoleContext';

export function useRole(): { role: Role; setRole: (r: Role) => void } {
  const ctx = useContext(RoleContext);
  if (ctx.role === null) {
    throw new Error('useRole must be used within a <RoleProvider>');
  }
  return ctx as { role: Role; setRole: (r: Role) => void };
}
