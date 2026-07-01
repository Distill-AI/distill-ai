import { useState } from 'react';
import type { RefObject } from 'react';

export type ClipboardCopyStatus = 'idle' | 'copied' | 'fallback';

/**
 * Copies text to the clipboard, falling back to selecting `fallbackRef`'s contents when the
 * Clipboard API is unavailable (insecure context, permissions policy, older browser) so the user
 * can still copy manually instead of hitting an uncaught rejection.
 */
export function useClipboardCopy() {
  const [status, setStatus] = useState<ClipboardCopyStatus>('idle');

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
  }

  return { status, copy };
}
