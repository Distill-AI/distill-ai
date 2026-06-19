/**
 * Shape of a tool‑invocation request that the registry receives.
 *
 * `toolName` – case‑insensitive name of the registered tool.
 * `args`      – raw arguments; they will be validated against the tool’s
 *               `inputSchema` before execution.
 */
export interface InvokeRequestDto {
  /** Name of the tool to invoke */
  toolName: string;

  /** Raw arguments (will be validated with Zod) */
  args: unknown;
}
