import { renderHook, act } from '@testing-library/react';
import { useClipboardCopy } from './useClipboardCopy';

describe('useClipboardCopy', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  it('copies text via the Clipboard API and sets status to "copied"', async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    const { result } = renderHook(() => useClipboardCopy());

    await act(async () => {
      await result.current.copy('hello world');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world');
    expect(result.current.status).toBe('copied');
  });

  it('falls back to selecting the fallback element and sets status to "fallback" when writeText rejects', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    const el = document.createElement('div');
    document.body.appendChild(el);
    const fallbackRef = { current: el };
    const selectNodeContents = vi.fn();
    const addRange = vi.fn();
    const removeAllRanges = vi.fn();
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents,
    } as unknown as Range);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);

    const { result } = renderHook(() => useClipboardCopy());

    await act(async () => {
      await result.current.copy('hello world', fallbackRef);
    });

    expect(selectNodeContents).toHaveBeenCalledWith(el);
    expect(removeAllRanges).toHaveBeenCalled();
    expect(addRange).toHaveBeenCalled();
    expect(result.current.status).toBe('fallback');

    document.body.removeChild(el);
  });

  it('falls back to calling select() on a textarea fallback target', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    const select = vi.spyOn(el, 'select');
    const fallbackRef = { current: el };

    const { result } = renderHook(() => useClipboardCopy());

    await act(async () => {
      await result.current.copy('hello world', fallbackRef);
    });

    expect(select).toHaveBeenCalled();
    expect(result.current.status).toBe('fallback');

    document.body.removeChild(el);
  });

  it('does not throw and still sets status to "fallback" when writeText rejects with no fallbackRef', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useClipboardCopy());

    await expect(
      act(async () => {
        await result.current.copy('hello world');
      }),
    ).resolves.not.toThrow();

    expect(result.current.status).toBe('fallback');
  });

  it('resets status to "idle" after the reset delay', async () => {
    vi.useFakeTimers();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    const { result } = renderHook(() => useClipboardCopy());

    await act(async () => {
      await result.current.copy('hello world');
    });
    expect(result.current.status).toBe('copied');

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.status).toBe('idle');

    vi.useRealTimers();
  });
});
