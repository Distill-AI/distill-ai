export interface CopilotExplanation {
  // Empty string for auto-eligible quotes (EC-02). This is an endpoint-level convention that
  // #112 must implement itself: the underlying tool's schema requires a non-empty string and
  // its own fallback never returns "", so the endpoint has to short-circuit auto-eligible
  // requests before calling the tool, not pass them through.
  explanation: string;
  degraded: boolean; // true when the LLM was unreachable and a template fallback was used
}
