import { PRIMARY_ACTION_LABELS } from './actionLabels';

describe('PRIMARY_ACTION_LABELS', () => {
  it('holds the exact label for each of the three primary-action screens', () => {
    expect(PRIMARY_ACTION_LABELS).toEqual({
      reviewApprove: 'Approve & generate',
      clarificationSend: 'Mark as sent',
      quoteApprove: 'Approve & ready',
    });
  });

  it('never implies a real outbound send (AC-01)', () => {
    for (const label of Object.values(PRIMARY_ACTION_LABELS)) {
      expect(label.toLowerCase()).not.toContain('send');
    }
  });
});
