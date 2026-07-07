import { useId, useState } from 'react';
import type { AxiosError } from 'axios';
import { useAskCopilot } from '../../api/askCopilot';
import { GENERIC_ERROR } from '../../lib/errorMessages';
import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';

const MAX_LENGTH = 1000;

interface AskCopilotPanelProps {
  requestId: string;
}

export function AskCopilotPanel({ requestId }: AskCopilotPanelProps) {
  const [question, setQuestion] = useState('');
  const inputId = useId();
  const { mutate, isPending, isError, error, data, reset } = useAskCopilot(requestId);

  const canSubmit = question.trim().length > 0 && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutate(question);
  };

  const errorMessage = isError
    ? ((error as AxiosError<{ message?: string }>).response?.data?.message ?? GENERIC_ERROR)
    : null;

  return (
    <Disclosure
      defaultOpen={false}
      bodyClassName="max-h-96 overflow-y-auto"
      trigger={
        <>
          <span className="text-sm font-medium text-slate-600">Ask Copilot</span>
          <Badge>Agentic</Badge>
        </>
      }
    >
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ask a question about this request
        </label>
        <input
          id={inputId}
          type="text"
          value={question}
          maxLength={MAX_LENGTH}
          disabled={isPending}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (data || isError) reset();
          }}
          placeholder="Why is this line item flagged?"
          className="flex-1 rounded border border-border px-3 py-1.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded bg-indigo-600 px-3 py-1.5 text-[13px] text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Ask
        </button>
      </div>

      {isPending && <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-canvas" />}

      {errorMessage && (
        <p role="alert" className="mt-2 text-[13px] text-lo-tx">
          {errorMessage}
        </p>
      )}

      {data && (
        <div className="mt-3">
          <p className="text-sm text-body-text">{data.answer}</p>
          {data.trace.length > 0 && (
            <ol className="mt-2 space-y-1 text-[12px] text-muted">
              {data.trace.map((step, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span>{i + 1}.</span>
                  {step.tool && <Badge>{step.tool}</Badge>}
                  <span>{step.thought}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Disclosure>
  );
}
