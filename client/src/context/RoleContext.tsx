import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Role = 'RevOps' | 'Sales' | 'Admin';

const STORAGE_KEY = 'distill.role';
const DEFAULT_ROLE: Role = 'RevOps';

function readStoredRole(): Role {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'RevOps' || stored === 'Sales' || stored === 'Admin') return stored;
  return DEFAULT_ROLE;
}

const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({ role: DEFAULT_ROLE, setRole: () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole);

  function setRole(r: Role) {
    localStorage.setItem(STORAGE_KEY, r);
    setRoleState(r);
  }

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole() {
  return useContext(RoleContext);
}
