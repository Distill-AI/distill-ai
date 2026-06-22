import { createContext } from 'react';

export type Role = 'RevOps' | 'Sales' | 'Admin';

export const DEFAULT_ROLE: Role = 'RevOps';
export const STORAGE_KEY = 'distill.role';

export const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({ role: DEFAULT_ROLE, setRole: () => {} });
