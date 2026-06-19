import { ToolStatus } from '../enums/tool-call-status.enum';

/**
 * Standardised response from `ToolRegistry.invoke()`.
 *
 * `status` – one of the `ToolStatus` values.
 * `latency` – wall‑clock time (ms) measured from entry to exit.
 * `result` – present only when `status === ToolStatus.OK`.
 * `error`  – human‑readable message when not OK.
 */
export interface InvokeResponseDto<O = unknown> {
  /** Overall status of the call */
  status: ToolStatus;

  /** Execution latency in ms (wall‑clock) */
  latency: number;

  /** Result when `status === ToolStatus.OK` */
  result?: O;

  /** Human‑readable error message when not OK */
  error?: string;
}
