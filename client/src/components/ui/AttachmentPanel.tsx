const REASON_LABELS: Record<string, string> = {
  corrupt: 'This file appears to be password-protected or corrupt.',
  no_text_layer: 'This file contains only scanned images with no readable text.',
  unsupported_format: 'This file format is not supported.',
  size_limit_exceeded: 'This file exceeds the maximum allowed size.',
  unknown: 'This file could not be read.',
};

interface AttachmentPanelProps {
  filename: string;
  parseStatus: string;
  parseErrorReason?: string;
  isModalOpen?: boolean;
  onPasteClick: () => void;
}

export function AttachmentPanel({
  filename,
  parseStatus,
  parseErrorReason,
  isModalOpen = false,
  onPasteClick,
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
          type="button"
          aria-expanded={isModalOpen}
          aria-controls="paste-modal"
          onClick={onPasteClick}
          className="shrink-0 rounded px-2 py-1 text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          Paste content instead
        </button>
      </div>
    </div>
  );
}
