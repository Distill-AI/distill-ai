import { DistillMark } from './DistillMark';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="md:hidden flex items-center gap-3 px-4 h-12 bg-slate-900 flex-none">
      <button
        type="button"
        onClick={onMenuClick}
        className="text-white p-1 -ml-1"
        aria-label="Open navigation"
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
    </header>
  );
}
