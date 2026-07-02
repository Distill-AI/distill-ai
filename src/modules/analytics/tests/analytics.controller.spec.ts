import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { DEMO_ORG_ID } from '@modules/ingestion/ingestion.constants';
import { AnalyticsController } from '../analytics.controller';
import type { AnalyticsService } from '../analytics.service';
import type { AnalyticsSummary } from '../interfaces/analytics-summary.interface';

function setup() {
  const getSummary = vi.fn().mockResolvedValue({ quotes_this_week: 1 } as AnalyticsSummary);
  const controller = new AnalyticsController({ getSummary } as unknown as AnalyticsService);
  return { controller, getSummary };
}

describe('AnalyticsController.summary', () => {
  it('defaults to the last 7 days and wraps the payload', async () => {
    const { controller, getSummary } = setup();

    const res = await controller.summary({}, { user: { orgId: 'org-1' } as never });

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ quotes_this_week: 1 });
    const [orgId, window] = getSummary.mock.calls[0];
    expect(orgId).toBe('org-1');
    const spanMs = window.to.getTime() - window.from.getTime();
    expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('uses the provided ISO window', async () => {
    const { controller, getSummary } = setup();

    await controller.summary(
      { from: '2026-06-01T00:00:00.000Z', to: '2026-06-08T00:00:00.000Z' },
      { user: { orgId: 'org-1' } as never },
    );

    const [, window] = getSummary.mock.calls[0];
    expect(window.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(window.to.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('rejects a from that is not earlier than to (400)', async () => {
    const { controller, getSummary } = setup();

    await expect(
      controller.summary(
        { from: '2026-06-08T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' },
        { user: { orgId: 'org-1' } as never },
      ),
    ).rejects.toBeInstanceOf(CustomHttpException);
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('falls back to the demo org when there is no authenticated user', async () => {
    const { controller, getSummary } = setup();

    await controller.summary({}, {});

    expect(getSummary.mock.calls[0][0]).toBe(DEMO_ORG_ID);
  });
});
