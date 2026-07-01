import { useCallback, useEffect, useRef } from 'react';

export function useUnsavedChanges(hasUnsaved: boolean) {
  const prev = useRef(hasUnsaved);

  useEffect(() => {
    if (hasUnsaved === prev.current) return;
    prev.current = hasUnsaved;
  }, [hasUnsaved]);

  useEffect(() => {
    if (!hasUnsaved) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    addEventListener('beforeunload', onBeforeUnload);
    return () => removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const confirmNavigation = useCallback(
    (message: string) => {
      if (!hasUnsaved) return true;
      return window.confirm(message);
    },
    [hasUnsaved],
  );

  return { confirmNavigation };
}
