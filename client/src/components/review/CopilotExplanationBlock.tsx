import { useState, useId } from 'react';

interface CopilotExplanationBlockProps {
  explanation: string | undefined; // undefined while loading
  isLoading: boolean;
  isError: boolean;
  degraded?: boolean; // true when the LLM was unreachable and a template fallback was used
}

const BADGE_CLASS =
  'ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700';

export function CopilotExplanationBlock({
  explanation,
  isLoading,
  isError,
  degraded,
}: CopilotExplanationBlockProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  // EC-01: error -> hidden entirely (advisory-only, nothing to retry, nothing blocking)
  if (isError) return null;

  if (isLoading) {
    return (
      <div className="border-t border-border pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-600">Why this needs review</span>
          <span className={BADGE_CLASS}>AI explanation</span>
        </div>
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-canvas" />
      </div>
    );
  }

  // EC-02: empty string (auto-eligible) -> collapses (render null), not an empty badged box
  if (!explanation) return null;

  return (
    <div className="border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1.5"
        >
          <span className="text-sm font-medium text-slate-600">Why this needs review</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`h-3 w-3 text-muted transition-transform ${open ? '' : 'rotate-180'}`}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
          </svg>
          <span className={BADGE_CLASS}>AI explanation</span>
        </button>
        {degraded && (
          <span className="text-[11px] text-muted">Auto-generated, may be less precise</span>
        )}
      </div>

      <div
        id={bodyId}
        hidden={!open}
        className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-canvas p-3.5"
      >
        <p className="text-sm text-body-text">{explanation}</p>
      </div>
    </div>
  );
}
