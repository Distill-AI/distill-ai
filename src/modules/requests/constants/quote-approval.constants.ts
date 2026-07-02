import { RequestStatus } from '../enums/request-status.enum';

/**
 * Request statuses a quote may be approved from. A bare exported array in `requests/`, not inside
 * `RequestActions`, so `QuotesModule` can import it without pulling in `RequestsModule` and
 * re-creating the cycle `RequestsDataModule` already exists to avoid.
 *
 * `FAILED` is deliberately excluded: `PRICE` persists a `DRAFT` quote before `POLICY`/`SCORE` run,
 * so a request that fails during `POLICY` or `SCORE` can end up `FAILED` with a `Quote` row that
 * was never policy-applied or scored. `NEEDS_CLARIFICATION` is excluded too, though it is already
 * provably safe on its own: the only `{ kind: 'clarify' }` exit is in `parse.node.ts`, which runs
 * before pricing, so a `NEEDS_CLARIFICATION` request never has a `Quote` row at all.
 */
export const QUOTE_APPROVABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PRICED,
  RequestStatus.NEEDS_REVIEW,
];
