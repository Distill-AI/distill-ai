import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDownIcon } from './ChevronDownIcon';

interface DisclosureProps {
  trigger: ReactNode; // rendered inside the toggle button, before the chevron
  headerExtra?: ReactNode; // rendered after the button, outside it (e.g. a badge, a status note)
  defaultOpen?: boolean;
  children: ReactNode;
  bodyClassName?: string; // overrides the body panel's height/scroll classes for taller content
}

/** Shared collapsible section: a toggle button with a chevron plus a body panel, wired with
 * aria-expanded/aria-controls. Used by RoutingReasonsBanner and CopilotExplanationBlock. */
export function Disclosure({
  trigger,
  headerExtra,
  defaultOpen = true,
  children,
  bodyClassName = 'max-h-40 overflow-y-auto',
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1.5"
        >
          {trigger}
          <ChevronDownIcon open={open} />
        </button>
        {headerExtra}
      </div>

      <div
        id={bodyId}
        hidden={!open}
        className={`mt-2 rounded-lg bg-canvas p-3.5 ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
