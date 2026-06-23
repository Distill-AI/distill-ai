interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-card border border-lo-bg bg-lo-bg px-3 py-2 text-[13px] text-lo-tx"
    >
      <span aria-hidden="true" className="mt-px shrink-0">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}
