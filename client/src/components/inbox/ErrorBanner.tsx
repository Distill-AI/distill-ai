interface ErrorBannerProps {
  message: string;
  /** When provided, renders a Retry control (e.g. to refetch a failed query). */
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-card border border-lo-bg bg-lo-bg px-3 py-2 text-[13px] text-lo-tx"
    >
      <span aria-hidden="true" className="mt-px shrink-0">
        !
      </span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded border border-lo-tx/30 px-2 py-0.5 text-xs font-medium text-lo-tx hover:bg-lo-tx/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
