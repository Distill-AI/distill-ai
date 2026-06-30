import type { RefObject } from 'react';
import { usePageHeader } from '../../context/PageHeaderContext';
import { DistillMark } from './DistillMark';

interface TopBarProps {
  isOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}

function UserAvatar() {
  return (
    <div
      aria-label="Signed in as Avery Reed"
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
    >
      AR
    </div>
  );
}

export function TopBar({ isOpen, menuButtonRef, onMenuClick }: TopBarProps) {
  const { title, actions } = usePageHeader();

  return (
    <header
      className="flex flex-none items-center px-4 h-12 md:h-14 bg-slate-900 md:bg-surface md:border-b md:border-border md:shadow-sm"
      aria-label="Page header"
    >
      {/* Mobile: hamburger + logo */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuClick}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isOpen}
          aria-controls="sidebar-nav"
          className="text-white p-1 -ml-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <DistillMark size={18} color="#fff" />
        <span className="text-white text-[15px] font-semibold tracking-tight">
          Distill<span className="text-accent">.ai</span>
        </span>
      </div>

      {/* Desktop: title from context */}
      <div className="hidden md:flex min-w-0 items-center gap-3">{title}</div>

      {/* Right side: actions (desktop only) + avatar (always) */}
      <div className="ml-auto flex items-center gap-3">
        {actions && (
          <>
            <div className="hidden md:flex items-center gap-2">{actions}</div>
            <div className="hidden md:block h-5 w-px bg-border" aria-hidden="true" data-testid="header-divider" />
          </>
        )}
        <UserAvatar />
      </div>
    </header>
  );
}
