/**
 * A side effect that must run only after the current request's DB transaction has committed, so it
 * never observes state that a concurrent connection cannot yet see. The RLS middleware runs any
 * registered tasks once it commits (issue #93: the pipeline enqueue must not fire mid-transaction).
 */
export type AfterCommitTask = () => Promise<void>;

/** Request augmentation carrying the post-commit task queue the RLS middleware drains on commit. */
export interface WithAfterCommit {
  afterCommit?: AfterCommitTask[];
}
