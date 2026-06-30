import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { PageHeaderProvider } from '../../context/PageHeaderContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeSidebar() {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSidebar();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  return (
    <PageHeaderProvider>
      <div className="flex h-screen overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar
            isOpen={sidebarOpen}
            menuButtonRef={menuButtonRef}
            onMenuClick={() => setSidebarOpen((open) => !open)}
          />
          <main className="flex-1 overflow-y-auto bg-canvas">{children}</main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
