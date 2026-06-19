import { z, ZodTypeAny } from 'zod';

/**
 * Generic contract that every tool must implement.
 *
 * I – Zod schema that describes the *input* shape.
 * O – Zod schema that describes the *output* shape.
 *
 * The `toolName` is stored lower‑cased and **must not** be one of the reserved
 * words `price`, `policy`, `score`.
 */
export interface ToolContract<I extends ZodTypeAny, O extends ZodTypeAny> {
  /** Unique name of the tool (lower‑case) */
  readonly toolName: string;

  /** Human‑readable description – used for docs / UI */
  readonly description: string;

  /** Zod schema that validates arguments passed to `invoke()` */
  readonly inputSchema: I;

  /** Zod schema that validates the result returned by `execute()` */
  readonly outputSchema: O;

  /**
   * Core implementation. The method receives the **parsed** input (`I`) and
   * must return a value that satisfies the output Zod schema `O`.
   */
  execute(input: z.infer<I>, abortSignal?: AbortSignal): Promise<z.infer<O>>;
}
