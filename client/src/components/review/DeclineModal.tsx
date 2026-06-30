import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AxiosError } from 'axios';
import { useDeclineRequest } from '../../api/requests';

const DECLINE_REASONS = [
  'Not a relevant request',
  'Insufficient information',
  'Customer not qualified',
  'Duplicate request',
  'Other',
];

interface DeclineModalProps {
  requestId: string;
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function DeclineModal({ requestId, open, onClose, triggerRef }: DeclineModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const tokenRef = useRef(0);
  const mutation = useDeclineRequest();
  const handleCloseRef = useRef<() => void>(() => {});

  const handleClose = useCallback(() => {
    tokenRef.current += 1;
    mutation.reset();
    setReason('');
    setCustomReason('');
    setError(null);
    onClose();
    triggerRef.current?.focus();
  }, [mutation, onClose, triggerRef]);

  function handleConfirm() {
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) return;
    const token = ++tokenRef.current;
    mutation.mutate(
      { requestId, reason: finalReason },
      {
        onSuccess: () => {
          if (token !== tokenRef.current) return;
          handleClose();
        },
        onError: (err: AxiosError) => {
          if (token !== tokenRef.current) return;
          const status = err.response?.status;
          if (!status || status >= 500) {
            setError('Failed to decline. Please try again.');
            return;
          }
          const data = err.response?.data as { message?: string } | undefined;
          setError(data?.message ?? 'Invalid input.');
        },
      },
    );
  }

  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  useEffect(() => {
    if (!open) return;
    selectRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), textarea, input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      if (e.shiftKey && document.activeElement === focusable[0]) {
        e.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        e.preventDefault();
        focusable[0].focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const isConfirmDisabled =
    !reason || (reason === 'Other' && !customReason.trim()) || mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-modal-title"
        className="w-full max-w-md rounded-card bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="decline-modal-title" className="mb-4 text-base font-semibold text-slate-900">
          Decline request
        </h2>
        <div className="flex flex-col gap-3">
          <select
            ref={selectRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Decline reason"
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a reason...</option>
            {DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {reason === 'Other' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe the reason..."
              aria-label="Custom decline reason"
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-4 rounded-button text-[13px] font-medium text-slate-900 hover:bg-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="h-9 px-4 rounded-button bg-rose-600 text-white text-[13px] font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Declining...' : 'Confirm decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
