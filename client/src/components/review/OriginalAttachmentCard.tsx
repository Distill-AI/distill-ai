import { useState } from 'react';
import type { AttachmentSummary } from '../../api/requests';
import { downloadAttachment } from '../../api/attachments';
import { formatFileSize } from '../../lib/formatFileSize';
import { ATTACHMENT_DOWNLOAD_FAILED } from '../../lib/errorMessages';

function labelForMime(mime: string): string {
  if (mime === 'application/pdf') return 'PDF Document';
  if (mime === 'text/csv') return 'CSV Document';
  if (mime.startsWith('text/')) return 'Text Document';
  return mime;
}

function FileIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-accent"
      fill="none"
    >
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface OriginalAttachmentCardProps {
  requestId: string;
  attachment: AttachmentSummary;
  onError?: (message: string) => void;
}

/** Review-screen download affordance: shows attachment name/type/size and downloads the original bytes on click. */
export function OriginalAttachmentCard({
  requestId,
  attachment,
  onError,
}: OriginalAttachmentCardProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    onError?.(''); // clear any stale error from a previous attempt
    setDownloading(true);
    try {
      await downloadAttachment(requestId, attachment.id, attachment.filename);
    } catch {
      onError?.(ATTACHMENT_DOWNLOAD_FAILED);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-canvas px-3 py-2.5">
      <FileIcon />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-body-text">{attachment.filename}</div>
        <div className="text-xs text-muted">
          {labelForMime(attachment.mime_type)} · {formatFileSize(attachment.size_bytes)}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        aria-label={`Download ${attachment.filename}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-button border border-border text-body-text transition-colors hover:bg-surface hover:text-accent disabled:opacity-50"
      >
        <DownloadIcon />
      </button>
    </div>
  );
}
