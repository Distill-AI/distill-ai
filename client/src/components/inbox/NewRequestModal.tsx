import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { formatFileSize } from '../../lib/formatFileSize';
import { useCreateRequest } from '../../api/requests';

const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.txt'];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

type InputMode = 'upload' | 'email';

interface NewRequestModalProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function isAllowedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}`;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface FileChipProps {
  file: File;
  onRemove: () => void;
}

function FileChip({ file, onRemove }: FileChipProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-full">
      <div className="flex items-center gap-2 overflow-hidden min-w-0">
        <span className="text-muted shrink-0">
          <FileIcon />
        </span>
        <span className="text-[13px] text-slate-900 truncate">
          {file.name} · {formatFileSize(file.size)}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted hover:text-lo-tx transition-colors p-0.5 rounded-full hover:bg-lo-bg ml-2 shrink-0"
        aria-label={`Remove ${file.name}`}
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

export function NewRequestModal({ open, onClose, triggerRef }: NewRequestModalProps) {
  const [mode, setMode] = useState<InputMode>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [emailText, setEmailText] = useState('');
  const [hasRejectedFiles, setHasRejectedFiles] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const createRequest = useCreateRequest();
  const createRequestRef = useRef(createRequest);
  useEffect(() => {
    createRequestRef.current = createRequest;
  }, [createRequest]);

  const canProcess = mode === 'upload' ? files.length > 0 : emailText.trim().length > 0;

  const handleClose = useCallback(() => {
    createRequestRef.current.reset();
    setSubmitError(null);
    setMode('upload');
    setFiles([]);
    setEmailText('');
    setHasRejectedFiles(false);
    onClose();
    triggerRef.current?.focus();
  }, [onClose, triggerRef]);

  function addFiles(incoming: FileList | File[]) {
    const all = Array.from(incoming);
    const allowed = all.filter(isAllowedFile);

    if (all.length > 0 && allowed.length === 0) {
      setHasRejectedFiles(true);
      return;
    }

    setHasRejectedFiles(false);
    setFiles((prev) => {
      const keys = new Set(prev.map(fileKey));
      const next = [...prev];
      for (const file of allowed) {
        const key = fileKey(file);
        if (!keys.has(key)) {
          keys.add(key);
          next.push(file);
        }
      }
      return next;
    });
  }

  function removeFile(target: File) {
    setFiles((prev) => prev.filter((f) => fileKey(f) !== fileKey(target)));
  }

  function handleProcess() {
    if (!canProcess) return;
    if (mode === 'email') {
      setSubmitError(null);
      createRequest.mutate(
        { channel: 'email', source_body: emailText.trim() },
        {
          onSuccess: () => handleClose(),
          onError: (err) => {
            const message =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Something went wrong. Please try again.';
            setSubmitError(message);
          },
        },
      );
      return;
    }
    // TODO(US-E1-1): wire upload mutation
    handleClose();
  }

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const selector =
        'a[href], button:not([disabled]), textarea, input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.closest('[hidden]') && el.offsetParent !== null,
      );
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
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-request-title"
        className="relative bg-surface rounded-card shadow-lg w-full max-w-[560px] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2
            id="new-request-title"
            className="text-base font-semibold text-slate-900 tracking-tight"
          >
            New request
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-slate-900 transition-colors p-1 rounded-button hover:bg-canvas"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col gap-6">
          <div
            className="flex p-1 bg-canvas rounded-lg border border-border w-full"
            role="tablist"
            aria-label="Input method"
          >
            <button
              type="button"
              role="tab"
              id="new-request-tab-upload"
              aria-controls="new-request-panel-upload"
              aria-selected={mode === 'upload'}
              tabIndex={mode === 'upload' ? 0 : -1}
              onClick={() => setMode('upload')}
              className={[
                'flex-1 py-1.5 px-3 rounded text-sm font-medium transition-all text-center',
                mode === 'upload'
                  ? 'bg-surface text-slate-900 shadow-sm border border-border/50'
                  : 'text-body-text hover:text-slate-900',
              ].join(' ')}
            >
              Upload files
            </button>
            <button
              type="button"
              role="tab"
              id="new-request-tab-email"
              aria-controls="new-request-panel-email"
              aria-selected={mode === 'email'}
              tabIndex={mode === 'email' ? 0 : -1}
              onClick={() => setMode('email')}
              className={[
                'flex-1 py-1.5 px-3 rounded text-sm font-medium transition-all text-center',
                mode === 'email'
                  ? 'bg-surface text-slate-900 shadow-sm border border-border/50'
                  : 'text-body-text hover:text-slate-900',
              ].join(' ')}
            >
              Paste email
            </button>
          </div>

          <div
            role="tabpanel"
            id="new-request-panel-upload"
            aria-labelledby="new-request-tab-upload"
            hidden={mode !== 'upload'}
            className="flex flex-col gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              aria-label="Upload files: drag and drop PDF, CSV, or TXT, or browse"
              className="border-[1.5px] border-dashed border-border rounded-card h-[140px] w-full flex flex-col items-center justify-center gap-2 bg-surface hover:bg-canvas transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
              }}
            >
              <span className="text-muted group-hover:text-body-text transition-colors">
                <UploadIcon />
              </span>
              <span className="flex flex-col items-center gap-1">
                <span className="text-sm text-slate-900 font-medium">
                  Drag &amp; drop PDF, CSV, or TXT
                </span>
                <span className="text-[13px] text-indigo-600 group-hover:text-indigo-700 transition-colors">
                  or browse
                </span>
              </span>
            </button>

            {hasRejectedFiles && (
              <p role="alert" className="text-[13px] text-lo-tx">
                Only PDF, CSV, and TXT files are accepted.
              </p>
            )}

            {files.length > 0 && (
              <div className="flex flex-col gap-2">
                {files.map((file) => (
                  <FileChip key={fileKey(file)} file={file} onRemove={() => removeFile(file)} />
                ))}
              </div>
            )}
          </div>

          <div
            role="tabpanel"
            id="new-request-panel-email"
            aria-labelledby="new-request-tab-email"
            hidden={mode !== 'email'}
          >
            <label htmlFor="email-body" className="sr-only">
              Email body
            </label>
            <textarea
              id="email-body"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the full email thread here…"
              rows={8}
              className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-600/30 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border bg-surface flex justify-end gap-3">
          {submitError && (
            <p role="alert" className="text-[13px] text-lo-tx mr-auto">
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-4 h-9 rounded-button text-[13px] font-medium text-slate-900 hover:bg-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcess}
            disabled={!canProcess || createRequest.isPending}
            className="px-4 h-9 rounded-button bg-indigo-600 text-white text-[13px] font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          >
            Process request
          </button>
        </div>
      </div>
    </div>
  );
}
