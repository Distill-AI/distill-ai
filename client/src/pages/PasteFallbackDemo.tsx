import { useRef, useState } from 'react';
import { AttachmentPanel } from '../components/ui/AttachmentPanel';
import { PasteModal } from '../components/inbox/PasteModal';

const REQUEST_ID = 'a1111111-0000-0000-0000-000000000001';
const ATTACHMENT_ID = 'b2222222-0000-0000-0000-000000000001';

export function PasteFallbackDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pasted, setPasted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="px-6 py-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">
        PR Evidence: Paste Fallback UI
      </h1>
      {pasted ? (
        <div className="rounded-card border border-hi-tx/40 bg-hi-bg/30 px-3 py-2 text-[13px]">
          <p className="font-medium text-hi-tx">rfq.pdf</p>
          <p className="mt-0.5 text-body-text">Content accepted - extraction re-queued.</p>
        </div>
      ) : (
        <AttachmentPanel
          filename="rfq.pdf"
          parseStatus="unparsed"
          parseErrorReason="corrupt"
          isModalOpen={modalOpen}
          onPasteClick={() => setModalOpen(true)}
          triggerRef={triggerRef}
        />
      )}
      <PasteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPasteSuccess={() => setPasted(true)}
        requestId={REQUEST_ID}
        attachmentId={ATTACHMENT_ID}
        triggerRef={triggerRef}
      />
    </div>
  );
}
