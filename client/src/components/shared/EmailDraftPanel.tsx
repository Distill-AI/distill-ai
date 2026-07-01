export interface EmailDraftPanelProps {
  /** Recipient, shown as a read-only row. Omitted entirely when the recipient is implicit (Clarification). */
  to?: string;
  subject: string;
  body: string;
  onSubjectChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
  readOnly?: boolean;
  trailingActions: React.ReactNode;
}

/**
 * Editable-email panel shared by the Clarification and Quote Output screens: a Subject input, a
 * Message textarea, and a trailing action slot. `readOnly` swaps the inputs into the `readOnly`
 * (not `disabled`) attribute so the drafted copy stays selectable/copyable while locked from edits.
 */
export function EmailDraftPanel({
  to,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  readOnly = false,
  trailingActions,
}: EmailDraftPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      {to !== undefined && (
        <div className="flex flex-col gap-1">
          <label htmlFor="email-draft-to" className="text-xs font-medium text-muted">
            To
          </label>
          <input
            id="email-draft-to"
            type="text"
            value={to}
            readOnly
            className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-body-text"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email-draft-subject" className="text-xs font-medium text-muted">
          Subject
        </label>
        <input
          id="email-draft-subject"
          type="text"
          value={subject}
          readOnly={readOnly}
          onChange={onSubjectChange ? (e) => onSubjectChange(e.target.value) : undefined}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-body-text read-only:bg-canvas"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email-draft-body" className="text-xs font-medium text-muted">
          Message
        </label>
        <textarea
          id="email-draft-body"
          value={body}
          readOnly={readOnly}
          onChange={onBodyChange ? (e) => onBodyChange(e.target.value) : undefined}
          rows={10}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-body-text read-only:bg-canvas"
        />
      </div>

      <div className="flex justify-end gap-2">{trailingActions}</div>
    </div>
  );
}
