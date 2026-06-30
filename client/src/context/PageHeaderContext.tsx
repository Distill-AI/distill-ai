/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface PageHeaderValue {
  title: ReactNode;
  actions: ReactNode | null;
  setTitle: (t: ReactNode) => void;
  setActions: (a: ReactNode | null) => void;
}

const PageHeaderContext = createContext<PageHeaderValue | null>(null);

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeader must be used inside PageHeaderProvider');
  return ctx;
}

interface PageHeaderProviderProps {
  children: ReactNode;
  resetKey?: unknown;
}

export function PageHeaderProvider({ children, resetKey }: PageHeaderProviderProps) {
  const [title, setTitle] = useState<ReactNode>(null);
  const [actions, setActions] = useState<ReactNode | null>(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setTitle(null);
    setActions(null);
  }

  return (
    <PageHeaderContext.Provider value={{ title, actions, setTitle, setActions }}>
      {children}
    </PageHeaderContext.Provider>
  );
}
