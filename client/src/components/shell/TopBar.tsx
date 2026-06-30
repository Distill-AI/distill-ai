import type { RefObject } from 'react';
import { usePageHeader } from '../../context/PageHeaderContext';
import { useUser } from '../../context/UserContext';
import { DistillMark } from './DistillMark';

interface TopBarProps {
  isOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}

interface UserAvatarProps {
  name: string;
  initials: string;
}

function UserAvatar({ name, initials }: UserAvatarProps) {
  return (
    <div
      aria-label={`Signed in as ${name}`}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
    >
      {initials}
    </div>
  );
}

export function TopBar({ isOpen, menuButtonRef, onMenuClick }: TopBarProps) {
  const { title, actions } = usePageHeader();
  const user = useUser();

  return (
    <header
      className="flex flex-none items-center px-4 h-12 md:h-14 bg-slate-900 md:bg-surface md:border-b md:border-border md:shadow-sm"
      aria-label="Page header"
    >
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

      <div className="hidden md:flex min-w-0 items-center gap-3">{title}</div>

      <div className="ml-auto flex items-center gap-3">
        {actions && (
          <>
            <div className="flex items-center gap-2">{actions}</div>
            <div
              className="hidden md:block h-5 w-px bg-border"
              aria-hidden="true"
              data-testid="header-divider"
            />
          </>
        )}
        <UserAvatar name={user.name} initials={user.initials} />
      </div>
    </header>
  );
}
