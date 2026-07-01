import type { RefObject } from 'react';
import { REASON_LABELS } from '../../lib/parseErrorReasons';
import type { ParseErrorReason, ParseStatus } from '../../lib/parseErrorReasons';

export type { ParseErrorReason, ParseStatus };

interface AttachmentPanelProps {
  filename: string;
  parseStatus: ParseStatus;
  parseErrorReason?: ParseErrorReason;
  isModalOpen?: boolean;
  onPasteClick: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  pasteModalId?: string;
}

export function AttachmentPanel({
  filename,
  parseStatus,
  parseErrorReason,
  isModalOpen = false,
  onPasteClick,
  triggerRef,
  pasteModalId,
}: AttachmentPanelProps) {
  if (parseStatus !== 'unparsed') return null;

  const reasonLabel =
    parseErrorReason && REASON_LABELS[parseErrorReason]
      ? REASON_LABELS[parseErrorReason]
      : REASON_LABELS.unknown;

  return (
    <div className="rounded-card border border-lo-tx/40 bg-lo-bg/30 px-3 py-2 text-[13px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-lo-tx">{filename}</p>
          <p className="mt-0.5 text-body-text">{reasonLabel}</p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isModalOpen}
          aria-controls={pasteModalId}
          onClick={onPasteClick}
          className="shrink-0 rounded px-2 py-1 text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          Paste content instead
        </button>
      </div>
    </div>
  );
}
