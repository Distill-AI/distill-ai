import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useRequest } from '../api/requests';
import {
  useClarification,
  useGenerateClarificationDraft,
  useUpdateClarificationDraft,
  useSendClarification,
} from '../api/clarification';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { BlockingItemsCard } from '../components/clarification/BlockingItemsCard';
import { EmailDraftPanel } from '../components/shared/EmailDraftPanel';
import { usePageHeader } from '../context/PageHeaderContext';
import { ChevronLeftIcon } from '../components/ui/ChevronLeftIcon';
import { PRIMARY_ACTION_LABELS } from '../lib/actionLabels';
import { REASON_LABELS } from '../lib/parseErrorReasons';

function isNotFound(error: unknown): boolean {
  return (error as AxiosError | undefined)?.response?.status === 404;
}

export function Clarification() {
  const { id } = useParams<{ id: string }>();
  const {
    data: request,
    isLoading: isRequestLoading,
    isError: isRequestError,
    refetch,
  } = useRequest(id);
  const {
    data: clarification,
    isLoading: isClarificationLoading,
    isError: isClarificationError,
    error: clarificationError,
  } = useClarification(id);
  const generateDraft = useGenerateClarificationDraft();
  const { mutate: updateDraftMutate, isPending: isSavingDraft } = useUpdateClarificationDraft();
  const { mutate: sendClarificationMutate, isPending: isSending } = useSendClarification();
  const { setTitle, setActions } = usePageHeader();

  const [isEditing, setIsEditing] = useState(false);
  const [localSubject, setLocalSubject] = useState('');
  const [localBody, setLocalBody] = useState('');
  const localSubjectRef = useRef('');
  const localBodyRef = useRef('');

  // Reset per-request edit state when navigating between requests (adjust-state-on-prop-change,
  // not an effect, so there is no extra render pass — mirrors Review.tsx).
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setIsEditing(false);
  }

  const generateAttemptedRef = useRef(false);
  useEffect(() => {
    generateAttemptedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!request || clarification) return;
    if (!isClarificationError || !isNotFound(clarificationError)) return;
    if (generateAttemptedRef.current) return;
    generateAttemptedRef.current = true;

    const gaps = request.attachments
      .filter((a) => a.parse_status === 'unparsed')
      .map((a) => `${a.filename}: ${REASON_LABELS[a.parse_error_reason ?? 'unknown']}`);

    generateDraft.mutate({ requestId: request.id, gaps });
  }, [request, clarification, isClarificationError, clarificationError, generateDraft]);

  useEffect(() => {
    setTitle(
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={id ? `/requests/${id}/review` : '/'}
          className="flex h-8 w-8 flex-none items-center justify-center rounded text-body-text hover:bg-canvas"
          aria-label="Back to review"
        >
          <ChevronLeftIcon />
        </Link>
        <h1 className="truncate text-lg font-semibold text-slate-900">
          Clarification · {request?.sender_company ?? request?.sender_contact ?? 'Request'}
        </h1>
      </div>,
    );
    return () => setTitle(null);
  }, [request, id, setTitle]);

  const handleSubjectChange = useCallback((value: string) => {
    localSubjectRef.current = value;
    setLocalSubject(value);
  }, []);

  const handleBodyChange = useCallback((value: string) => {
    localBodyRef.current = value;
    setLocalBody(value);
  }, []);

  const handleEditToggle = useCallback(() => {
    if (!clarification) return;
    if (isEditing) {
      updateDraftMutate(
        {
          id: clarification.id,
          draft_subject: localSubjectRef.current,
          draft_body: localBodyRef.current,
        },
        { onSuccess: () => setIsEditing(false) },
      );
      return;
    }
    const subject = clarification.draft_subject ?? '';
    const body = clarification.draft_body ?? '';
    localSubjectRef.current = subject;
    localBodyRef.current = body;
    setLocalSubject(subject);
    setLocalBody(body);
    setIsEditing(true);
  }, [clarification, isEditing, updateDraftMutate]);

  useEffect(() => {
    if (!clarification) {
      setActions(null);
      return () => setActions(null);
    }

    if (clarification.sent_at) {
      setActions(
        <span className="text-sm font-medium text-hi-tx">This clarification has been sent.</span>,
      );
      return () => setActions(null);
    }

    setActions(
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleEditToggle}
          disabled={isSavingDraft}
          className="h-9 rounded-button px-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isEditing ? (isSavingDraft ? 'Saving…' : 'Save') : 'Edit'}
        </button>
        <button
          type="button"
          onClick={() => sendClarificationMutate(clarification.id)}
          disabled={isSending}
          className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? 'Marking as sent…' : PRIMARY_ACTION_LABELS.clarificationSend}
        </button>
      </div>,
    );
    return () => setActions(null);
  }, [
    clarification,
    isEditing,
    isSavingDraft,
    isSending,
    handleEditToggle,
    sendClarificationMutate,
    setActions,
  ]);

  const isGenerating =
    !clarification &&
    isClarificationError &&
    isNotFound(clarificationError) &&
    !generateDraft.isError;
  const isLoading = isRequestLoading || isClarificationLoading || isGenerating;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 px-6 py-6">
      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          {isGenerating ? 'Drafting a clarification email…' : 'Loading…'}
        </div>
      ) : isRequestError || !request ? (
        <ErrorBanner message="Could not load this request." onRetry={() => void refetch()} />
      ) : generateDraft.isError ? (
        <ErrorBanner
          message="Could not draft a clarification email. Please try again."
          onRetry={() => {
            generateAttemptedRef.current = false;
            generateDraft.reset();
          }}
        />
      ) : !clarification ? (
        <ErrorBanner message="Could not load the clarification." onRetry={() => void refetch()} />
      ) : (
        <>
          <BlockingItemsCard gaps={clarification.gaps} />
          <EmailDraftPanel
            subject={isEditing ? localSubject : (clarification.draft_subject ?? '')}
            body={isEditing ? localBody : (clarification.draft_body ?? '')}
            onSubjectChange={isEditing ? handleSubjectChange : undefined}
            onBodyChange={isEditing ? handleBodyChange : undefined}
            readOnly={!isEditing}
            trailingActions={null}
          />
        </>
      )}
    </div>
  );
}
