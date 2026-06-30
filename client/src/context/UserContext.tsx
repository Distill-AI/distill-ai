/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface User {
  name: string;
  initials: string;
}

const DEMO_USER: User = { name: 'Avery Reed', initials: 'AR' };

const UserContext = createContext<User>(DEMO_USER);

export function useUser(): User {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  return <UserContext.Provider value={DEMO_USER}>{children}</UserContext.Provider>;
}
