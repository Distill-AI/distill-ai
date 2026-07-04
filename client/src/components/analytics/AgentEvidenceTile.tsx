import { num } from '../../lib/num';

interface AgentEvidenceTileProps {
  toolCallsTotal: number | undefined | null;
  crashRecoveries: number | undefined | null;
}

export function AgentEvidenceTile({ toolCallsTotal, crashRecoveries }: AgentEvidenceTileProps) {
  const tools = num(toolCallsTotal);
  const recoveries = num(crashRecoveries);

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Agent evidence</p>
      <div className="mt-4 flex items-baseline justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold text-slate-900">{tools.toLocaleString()}</span>
          <span className="text-xs text-muted">Tool calls</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-2xl font-bold text-slate-900">{recoveries.toLocaleString()}</span>
          <span className="text-xs text-muted">Crash recoveries</span>
        </div>
      </div>
    </div>
  );
}
