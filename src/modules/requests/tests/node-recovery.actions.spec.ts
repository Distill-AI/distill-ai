import { NodeRecoveryActions } from '../../pipeline/node-recovery.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import type { PipelineRunner } from '../../pipeline/pipeline.runner';

describe('NodeRecoveryActions', () => {
  let actions: NodeRecoveryActions;
  let mockRunner: Partial<PipelineRunner>;

  beforeEach(() => {
    mockRunner = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };
    actions = new NodeRecoveryActions(mockRunner as PipelineRunner);
  });

  describe('resumeFromCurrentNode', () => {
    it('enqueues the request for pipeline processing', async () => {
      await actions.resumeFromCurrentNode('req-1', ResumeReason.CRASH_RECOVERY);

      expect(mockRunner.enqueue).toHaveBeenCalledWith('req-1');
    });

    it('enqueues for manual resume reason', async () => {
      await actions.resumeFromCurrentNode('req-2', ResumeReason.MANUAL);

      expect(mockRunner.enqueue).toHaveBeenCalledWith('req-2');
    });

    it('resolves without error when enqueue succeeds', async () => {
      await expect(
        actions.resumeFromCurrentNode('req-1', ResumeReason.CRASH_RECOVERY),
      ).resolves.toBeUndefined();
    });

    it('propagates error when enqueue fails', async () => {
      mockRunner.enqueue = vi.fn().mockRejectedValue(new Error('Bull queue unavailable'));

      await expect(
        actions.resumeFromCurrentNode('req-1', ResumeReason.CRASH_RECOVERY),
      ).rejects.toThrow('Bull queue unavailable');
    });
  });
});
