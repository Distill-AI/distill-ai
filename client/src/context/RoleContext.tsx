import { useState } from 'react';
import type { ReactNode } from 'react';
import { RoleContext, DEFAULT_ROLE, STORAGE_KEY } from './roleContext';
import type { Role } from './roleContext';

export type { Role } from './roleContext';

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
      // swallow — role state still updates in memory
    }
    setRoleState(r);
  }

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
