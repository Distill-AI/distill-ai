export interface AskCopilotTraceStep {
  thought: string;
  tool: string | null;
  input: unknown;
  output: unknown;
}

export interface AskCopilotResponse {
  answer: string;
  trace: AskCopilotTraceStep[];
}
