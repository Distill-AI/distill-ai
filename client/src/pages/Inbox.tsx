import { useRef, useState } from 'react';
import { NewRequestModal } from '../components/inbox/NewRequestModal';

export function Inbox() {
  const [modalOpen, setModalOpen] = useState(false);
  const newRequestButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>
        <button
          ref={newRequestButtonRef}
          type="button"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          className="h-9 px-4 rounded-button bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New request
        </button>
      </div>

      <NewRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        triggerRef={newRequestButtonRef}
      />
    </div>
  );
}
