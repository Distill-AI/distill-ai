import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type ClipboardCopyStatus = 'idle' | 'copied' | 'fallback';

const STATUS_RESET_DELAY_MS = 2000;

/**
 * Copies text to the clipboard, falling back to selecting `fallbackRef`'s contents when the
 * Clipboard API is unavailable (insecure context, permissions policy, older browser) so the user
 * can still copy manually instead of hitting an uncaught rejection. `status` reverts to `idle`
 * after a short delay so the trailing button label doesn't stick after the first click.
 */
export function useClipboardCopy() {
  const [status, setStatus] = useState<ClipboardCopyStatus>('idle');
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  function scheduleReset(): void {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      resetTimeoutRef.current = null;
    }, STATUS_RESET_DELAY_MS);
  }

  async function copy(text: string, fallbackRef?: RefObject<HTMLElement | null>) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      const el = fallbackRef?.current;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        el.select();
      } else if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      setStatus('fallback');
    }
    scheduleReset();
  }

  return { status, copy };
}
