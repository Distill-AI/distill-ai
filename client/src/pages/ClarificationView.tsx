import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClarification, useUpdateDraft, useSendClarification } from '../api/clarifications';
import { useRequest } from '../api/requests';
import { usePageHeader } from '../context/PageHeaderContext';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { ChevronLeftIcon } from '../components/ui/ChevronLeftIcon';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GapItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-body-text">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lo-bg text-lo-tx">
        <CheckIcon />
      </span>
      <span>{label}</span>
    </li>
  );
}

function BlockerDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.focus();

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    function trapTab(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', trapTab);
    return () => document.removeEventListener('keydown', trapTab);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-lg"
      >
        <h2 id="unsaved-title" className="text-base font-semibold text-slate-900">
          Unsaved changes
        </h2>
        <p className="mt-2 text-sm text-muted">
          You have unsaved edits in your clarification draft. Leaving now will discard them.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-900 hover:bg-canvas"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClarificationView() {
  const { id: requestId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: request } = useRequest(requestId);
  const { data: clarification, isLoading, isError, refetch } = useClarification(requestId);
  const updateDraftMutation = useUpdateDraft();
  const sendMutation = useSendClarification();
  const [sendError, setSendError] = useState('');
  const { setTitle, setActions } = usePageHeader();

  const [subject, setSubject] = useState(clarification?.draft_subject ?? '');
  const [body, setBody] = useState(clarification?.draft_body ?? '');
  const [dirty, setDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const pendingNavigation = useRef<string | null>(null);

  const prevClarificationId = useRef(clarification?.id);

  useEffect(() => {
    if (!clarification) return;
    if (clarification.id === prevClarificationId.current) return;
    prevClarificationId.current = clarification.id;
    setSubject(clarification.draft_subject ?? '');
    setBody(clarification.draft_body ?? '');
    setDirty(false);
  }, [clarification]);

  const subjectTrimmed = subject.trim();
  const bodyTrimmed = body.trim();
  const canSend = subjectTrimmed.length > 0 && bodyTrimmed.length > 0 && !sending;

  useUnsavedChanges(dirty);

  const confirmNav = useCallback(
    (to: string) => {
      if (sending) return;
      if (dirty) {
        pendingNavigation.current = to;
        setShowBlocker(true);
      } else {
        navigate(to);
      }
    },
    [dirty, navigate, sending],
  );

  const handleDiscard = useCallback(() => {
    setShowBlocker(false);
    setDirty(false);
    if (pendingNavigation.current) {
      navigate(pendingNavigation.current);
      pendingNavigation.current = null;
    }
  }, [navigate]);

  const handleStay = useCallback(() => {
    setShowBlocker(false);
    pendingNavigation.current = null;
  }, []);

  useEffect(() => {
    const heading = request?.sender_company ?? request?.sender_contact ?? 'Request';
    setTitle(
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => confirmNav('/')}
          className="flex h-8 w-8 flex-none items-center justify-center rounded text-body-text hover:bg-canvas"
          aria-label="Back to inbox"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="truncate text-lg font-semibold text-slate-900">Clarification · {heading}</h1>
      </div>,
    );
    return () => setTitle(null);
  }, [request, setTitle, confirmNav, sending]);

  useEffect(() => {
    setActions(
      sending ? (
        <span className="text-sm text-muted">Sending…</span>
      ) : (
        <span className="text-sm text-muted">
          {dirty ? 'Edited · unsaved' : clarification?.sent_at ? 'Sent' : 'Draft'}
        </span>
      ),
    );
    return () => setActions(null);
  }, [setActions, dirty, sending, clarification?.sent_at]);

  async function handleSend() {
    if (!clarification || !canSend || clarification.sent_at) return;
    setSendError('');
    setSending(true);

    try {
      if (dirty) {
        await updateDraftMutation.mutateAsync({
          clarificationId: clarification.id,
          payload: { draft_subject: subjectTrimmed, draft_body: bodyTrimmed },
        });
        setSubject(subjectTrimmed);
        setBody(bodyTrimmed);
        setDirty(false);
      }

      await sendMutation.mutateAsync({
        clarificationId: clarification.id,
        requestId: clarification.request_id,
      });

      navigate(`/requests/${requestId}`);
    } catch (err) {
      setSending(false);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Failed to send clarification.')
          : 'Failed to send clarification.';
      setSendError(msg);
    }
  }

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Loading clarification…
        </div>
      </div>
    );
  }

  if (isError || !clarification) {
    return (
      <div className="px-6 py-6">
        <ErrorBanner
          message="Could not load clarification for this request."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const gaps = Array.isArray(clarification.gaps) ? (clarification.gaps as string[]) : [];
  const isSent = Boolean(clarification.sent_at);

  return (
    <div className="px-6 py-6">
      <BlockerDialog open={showBlocker} onConfirm={handleDiscard} onCancel={handleStay} />

      {sendError && (
        <div className="mb-4">
          <ErrorBanner message={sendError} />
        </div>
      )}

      {isSent && (
        <div className="mb-4 rounded-card border border-hi-bg bg-hi-bg px-3 py-2 text-[13px] text-hi-tx">
          This clarification has already been sent.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Detected gaps</h2>
          {gaps.length === 0 ? (
            <p className="text-sm text-muted">No gaps detected.</p>
          ) : (
            <ul className="space-y-2">
              {gaps.map((gap, index) => (
                <GapItem key={index} label={gap} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Draft</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="clar-subject" className="mb-1 block text-xs font-medium text-muted">
                Subject
              </label>
              <input
                id="clar-subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDirty(true);
                }}
                disabled={isSent}
                placeholder="Clarification subject"
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="clar-body" className="mb-1 block text-xs font-medium text-muted">
                Body
              </label>
              <textarea
                id="clar-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setDirty(true);
                }}
                disabled={isSent}
                placeholder="Clarification body"
                rows={10}
                className="w-full resize-y rounded-button border border-border bg-surface px-3 py-2 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => confirmNav(`/requests/${requestId}`)}
          className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-900 hover:bg-canvas"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || isSent}
          className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send clarification
        </button>
      </div>
    </div>
  );
}
