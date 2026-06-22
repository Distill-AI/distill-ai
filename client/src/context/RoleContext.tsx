/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Role = 'RevOps' | 'Sales' | 'Admin';

export const DEFAULT_ROLE: Role = 'RevOps';
export const STORAGE_KEY = 'distill.role';

export const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({ role: DEFAULT_ROLE, setRole: () => {} });

function readStoredRole(): Role {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'RevOps' || stored === 'Sales' || stored === 'Admin') return stored;
  } catch {
    // localStorage unavailable (private browsing, storage quota exceeded, etc.)
  }
  return DEFAULT_ROLE;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole);

  function setRole(r: Role) {
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      // swallow: role state still updates in memory
    }
    setRoleState(r);
  }

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
