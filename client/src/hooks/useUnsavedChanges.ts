import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChanges(hasUnsaved: boolean) {
  const blocker = useBlocker(hasUnsaved);

  useEffect(() => {
    if (!hasUnsaved) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    addEventListener('beforeunload', onBeforeUnload);
    return () => removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  return blocker;
}
