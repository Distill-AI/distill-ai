import { NavLink } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import type { Role } from '../../context/RoleContext';
import { DistillMark } from './DistillMark';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: Role[];
}

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuotesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inbox', to: '/', icon: <InboxIcon />, roles: ['RevOps', 'Sales', 'Admin'] },
  { label: 'Quotes', to: '/quotes', icon: <QuotesIcon />, roles: ['RevOps', 'Sales', 'Admin'] },
  { label: 'Catalog', to: '/catalog', icon: <CatalogIcon />, roles: ['RevOps', 'Admin'] },
  { label: 'Analytics', to: '/analytics', icon: <AnalyticsIcon />, roles: ['RevOps', 'Admin'] },
  {
    label: 'Settings',
    to: '/settings',
    icon: <SettingsIcon />,
    roles: ['RevOps', 'Sales', 'Admin'],
  },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { role } = useRole();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const initials = 'AR';
  const userName = 'Avery Reed';

  return (
    <nav
      className={[
        'flex flex-col w-52 flex-none bg-slate-900 h-full',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0 md:transition-none',
      ].join(' ')}
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <DistillMark size={18} color="#fff" />
        <span className="text-white text-[15px] font-semibold tracking-tight">
          Distill<span className="text-accent">.ai</span>
        </span>
      </div>

      <ul className="flex-1 px-2 space-y-0.5" role="list">
        {visibleItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white shadow-[inset_3px_0_0_#6366F1]'
                    : 'text-muted hover:text-white hover:bg-slate-800/60',
                ].join(' ')
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 px-4 py-4 border-t border-white/10">
        <div className="flex-none w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-white text-[13px] font-medium truncate">{userName}</p>
          <p className="text-muted text-[11px] truncate">{role}</p>
        </div>
      </div>
    </nav>
  );
}
