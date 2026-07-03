/** Formats a duration in whole seconds as "8m 13s" (or "45s" under a minute). */
export function formatDuration(totalSeconds: number): string {
  const total = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
