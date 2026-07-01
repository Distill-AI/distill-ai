import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRequest } from '../api/requests';
import type { QuoteDetail } from '../api/requests';
import { useApproveQuote, downloadQuotePdf, resolveApproveQuoteError } from '../api/quotes';
import { useClipboardCopy } from '../hooks/useClipboardCopy';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { QuoteDocumentPanel } from '../components/quote/QuoteDocumentPanel';
import { QuoteContextCard } from '../components/quote/QuoteContextCard';
import { EmailDraftPanel } from '../components/shared/EmailDraftPanel';
import { usePageHeader } from '../context/PageHeaderContext';
import { ChevronLeftIcon } from '../components/ui/ChevronLeftIcon';
import { PRIMARY_ACTION_LABELS } from '../lib/actionLabels';
import { formatMoney } from '../lib/formatMoney';

/** draft_quote_email is best-effort and can leave either field null; this fills the gap so the
 * panel always has something to show and copy. */
function buildFallbackEmail(quote: QuoteDetail): { subject: string; body: string } {
  const total = formatMoney(quote.total_minor, quote.currency);
  const leadTime =
    quote.lead_time_days !== null
      ? ` The estimated lead time is ${quote.lead_time_days} business days.`
      : '';
  return {
    subject: `Your quote ${quote.quote_number} from Distill.ai`,
    body: `Hi,\n\nPlease find attached your quote ${quote.quote_number}. The total is ${total}.${leadTime}\n\nBest regards,\nDistill.ai`,
  };
}

export function QuoteOutput() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError, refetch } = useRequest(id);
  const approveQuote = useApproveQuote(id ?? '');
  const { status: copyStatus, copy } = useClipboardCopy();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { setTitle, setActions } = usePageHeader();
  const [downloadError, setDownloadError] = useState('');

  const quote = request?.quote ?? null;
  const isReady = Boolean(quote?.pdf_storage_url);

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
          Quote {quote ? `· ${quote.quote_number}` : ''}
        </h1>
      </div>,
    );
    return () => setTitle(null);
  }, [id, quote, setTitle]);

  const handleDownload = useCallback(async () => {
    if (!id || !isReady) return;
    try {
      const blob = await downloadQuotePdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${quote?.quote_number ?? 'quote'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloadError('');
    } catch {
      setDownloadError('Could not download the quote PDF. Please try again.');
    }
  }, [id, isReady, quote]);

  useEffect(() => {
    if (!quote) {
      setActions(null);
      return () => setActions(null);
    }

    setActions(
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!isReady}
          className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download PDF
        </button>
        {isReady ? (
          <span className="text-sm font-medium text-hi-tx">This quote has been approved.</span>
        ) : (
          <button
            type="button"
            onClick={() => approveQuote.mutate()}
            disabled={approveQuote.isPending}
            className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approveQuote.isPending ? 'Approving…' : PRIMARY_ACTION_LABELS.quoteApprove}
          </button>
        )}
      </div>,
    );
    return () => setActions(null);
  }, [quote, isReady, approveQuote, handleDownload, setActions]);

  const approveErrorMessage = approveQuote.isError
    ? resolveApproveQuoteError(approveQuote.error)
    : null;

  const emailDraft = quote ? buildFallbackEmail(quote) : null;
  const emailSubject = quote?.email_draft_subject ?? emailDraft?.subject ?? '';
  const emailBody = quote?.email_draft_body ?? emailDraft?.body ?? '';

  return (
    <div className="flex h-full flex-col px-6 py-6">
      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Loading quote…
        </div>
      ) : isError || !request ? (
        <ErrorBanner message="Could not load this request." onRetry={() => void refetch()} />
      ) : !quote ? (
        <ErrorBanner
          message="This request does not have a quote yet."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {downloadError && <ErrorBanner message={downloadError} />}
          {approveErrorMessage && <ErrorBanner message={approveErrorMessage} />}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-h-0 lg:col-span-2">
              <QuoteDocumentPanel
                quote={quote}
                senderCompany={request.sender_company}
                senderContact={request.sender_contact}
                senderEmail={request.sender_email}
              />
            </div>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              <QuoteContextCard
                confidence={request.overall_confidence}
                lineCount={quote.lines.length}
                sourceFilename={request.attachments[0]?.filename ?? null}
              />
              <EmailDraftPanel
                to={request.sender_email ?? ''}
                subject={emailSubject}
                body={emailBody}
                readOnly
                bodyRef={bodyRef}
                trailingActions={
                  <button
                    type="button"
                    onClick={() => void copy(`${emailSubject}\n\n${emailBody}`, bodyRef)}
                    className="h-9 rounded-button border border-border px-3 text-sm font-medium text-body-text hover:bg-canvas"
                  >
                    {copyStatus === 'copied'
                      ? 'Copied!'
                      : copyStatus === 'fallback'
                        ? 'Press Ctrl+C to copy'
                        : 'Copy to Clipboard'}
                  </button>
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
