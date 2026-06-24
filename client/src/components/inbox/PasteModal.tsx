import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { usePasteAttachment } from '../../api/attachments';
import { GENERIC_ERROR } from '../../lib/errorMessages';

const MAX_LENGTH = 50_000;
const CHAR_WARNING_THRESHOLD = 5_000;

interface PasteModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  attachmentId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function PasteModal({
  open,
  onClose,
  requestId,
  attachmentId,
  triggerRef,
}: PasteModalProps) {
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { mutate, isPending } = usePasteAttachment();

  const remaining = MAX_LENGTH - content.length;
  const showCharWarning = remaining < CHAR_WARNING_THRESHOLD;

  const handleClose = useCallback(() => {
    setContent('');
    setErrorMessage(null);
    onClose();
    triggerRef.current?.focus();
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  const handleSubmit = () => {
    setErrorMessage(null);
    mutate(
      { requestId, attachmentId, content },
      {
        onSuccess: () => handleClose(),
        onError: () => setErrorMessage(GENERIC_ERROR),
      },
    );
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-modal-title"
      id="paste-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
    >
      <div className="w-full max-w-lg rounded-card bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="paste-modal-title" className="text-[15px] font-semibold text-slate-900">
            Paste attachment content
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-slate-900 transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-3 rounded px-3 py-2 text-[13px] bg-lo-bg/30 text-lo-tx">
            {errorMessage}
          </div>
        )}

        <label
          htmlFor="paste-content"
          className="block text-[13px] font-medium text-body-text mb-1"
        >
          Paste content
        </label>
        <textarea
          id="paste-content"
          rows={10}
          maxLength={MAX_LENGTH}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-[13px] text-slate-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {showCharWarning && (
          <p className="mt-1 text-[12px] text-body-text">
            {remaining.toLocaleString()} characters remaining
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-3 py-1.5 text-[13px] text-body-text hover:bg-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded bg-indigo-600 px-3 py-1.5 text-[13px] text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
