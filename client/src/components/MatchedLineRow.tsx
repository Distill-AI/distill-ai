import { ConfidenceChip } from './ConfidenceChip';
import type { MatchedLine } from '../api/interface/line-item';
import type { ConfidenceThresholds } from '../config/thresholds';

interface MatchedLineRowProps {
  line: MatchedLine;
  thresholds?: ConfidenceThresholds;
}

export function MatchedLineRow({ line, thresholds }: MatchedLineRowProps) {
  const { position, rawText, skuLabel, confidence } = line;

  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors hover:bg-canvas">
      <span className="w-6 text-right text-xs font-mono text-muted">{position}</span>
      <span className="flex-1 truncate text-sm text-body-text">{rawText}</span>
      <ConfidenceChip value={confidence} thresholds={thresholds} skuLabel={skuLabel ?? undefined} />
    </div>
  );
}
