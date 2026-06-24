import type { RequestDetail } from '../../api/requests';
import { OriginalAttachmentCard } from './OriginalAttachmentCard';

interface OriginalRequestPaneProps {
  request: RequestDetail;
  onError?: (message: string) => void;
}

/** Left pane of the Review workspace: the sender, the email body, and the original attachments. */
export function OriginalRequestPane({ request, onError }: OriginalRequestPaneProps) {
  const sender = request.sender_company ?? request.sender_contact ?? 'Unknown sender';

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Original request</h2>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {sender.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-body-text">{sender}</div>
          <div className="truncate text-xs text-muted">{request.sender_email ?? 'No email'}</div>
        </div>
      </div>

      {request.source_subject && (
        <div className="text-sm font-medium text-body-text">{request.source_subject}</div>
      )}

      <p className="whitespace-pre-wrap text-sm text-body-text">
        {request.source_body ?? 'No message body.'}
      </p>

      {request.attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Attachments
          </div>
          {request.attachments.map((attachment) => (
            <OriginalAttachmentCard
              key={attachment.id}
              requestId={request.id}
              attachment={attachment}
              onError={onError}
            />
          ))}
        </div>
      )}
    </section>
  );
}
