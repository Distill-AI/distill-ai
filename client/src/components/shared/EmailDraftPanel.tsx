import { useId } from 'react';

export interface EmailDraftPanelProps {
  /** Recipient, shown as a read-only row. Omitted entirely when the recipient is implicit (Clarification). */
  to?: string;
  subject: string;
  body: string;
  onSubjectChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
  readOnly?: boolean;
  trailingActions: React.ReactNode;
  /** Forwarded to the body textarea so a copy-to-clipboard fallback can select visible text. */
  bodyRef?: React.RefObject<HTMLTextAreaElement | null>;
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
  bodyRef,
}: EmailDraftPanelProps) {
  // A missing change handler makes the field non-editable regardless of `readOnly`: without an
  // onChange, a value-controlled field would look editable but silently discard keystrokes on
  // the next re-render (React's uncontrolled-without-onChange trap).
  const subjectReadOnly = readOnly || !onSubjectChange;
  const bodyReadOnly = readOnly || !onBodyChange;
  const instanceId = useId();
  const toId = `email-draft-to-${instanceId}`;
  const subjectId = `email-draft-subject-${instanceId}`;
  const bodyId = `email-draft-body-${instanceId}`;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      {to !== undefined && (
        <div className="flex flex-col gap-1">
          <label htmlFor={toId} className="text-xs font-medium text-muted">
            To
          </label>
          <input
            id={toId}
            type="text"
            value={to}
            readOnly
            className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-body-text"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={subjectId} className="text-xs font-medium text-muted">
          Subject
        </label>
        <input
          id={subjectId}
          type="text"
          value={subject}
          readOnly={subjectReadOnly}
          onChange={onSubjectChange ? (e) => onSubjectChange(e.target.value) : undefined}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-body-text read-only:bg-canvas"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={bodyId} className="text-xs font-medium text-muted">
          Message
        </label>
        <textarea
          id={bodyId}
          ref={bodyRef}
          value={body}
          readOnly={bodyReadOnly}
          onChange={onBodyChange ? (e) => onBodyChange(e.target.value) : undefined}
          rows={10}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-body-text read-only:bg-canvas"
        />
      </div>

      <div className="flex justify-end gap-2">{trailingActions}</div>
    </div>
  );
}
