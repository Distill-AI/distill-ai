export interface CopilotExplanation {
  explanation: string; // empty string for auto-eligible quotes (EC-02)
  degraded: boolean; // true when the LLM was unreachable and a template fallback was used
}
