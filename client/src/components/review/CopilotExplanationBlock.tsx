import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';

interface CopilotExplanationBlockProps {
  explanation: string | undefined; // undefined while loading
  isLoading: boolean;
  isError: boolean;
  degraded?: boolean; // true when the LLM was unreachable and a template fallback was used
}

export function CopilotExplanationBlock({
  explanation,
  isLoading,
  isError,
  degraded,
}: CopilotExplanationBlockProps) {
  // EC-01: error -> hidden entirely (advisory-only, nothing to retry, nothing blocking)
  if (isError) return null;

  if (isLoading) {
    return (
      <div className="border-t border-border pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-600">Why this needs review</span>
          <Badge>AI explanation</Badge>
        </div>
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-canvas" />
      </div>
    );
  }

  // EC-02: empty string (auto-eligible) -> collapses (render null), not an empty badged box
  if (!explanation) return null;

  return (
    <Disclosure
      trigger={
        <>
          <span className="text-sm font-medium text-slate-600">Why this needs review</span>
          <Badge>AI explanation</Badge>
        </>
      }
      headerExtra={
        degraded && (
          <span className="text-[11px] text-muted">Auto-generated, may be less precise</span>
        )
      }
    >
      <p className="text-sm text-body-text">{explanation}</p>
    </Disclosure>
  );
}
