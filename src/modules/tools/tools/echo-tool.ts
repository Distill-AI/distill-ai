import { z } from 'zod';
import { ToolContract } from '../interfaces/tool-contract.interface';
import { ToolTier } from '../enums/tools.enums';

export const EchoToolInputSchema = z.object({
  message: z.string(),
});

export const EchoToolOutputSchema = z.object({
  echoed: z.string(),
});

export const EchoTool: ToolContract<typeof EchoToolInputSchema, typeof EchoToolOutputSchema> = {
  toolName: 'echo_tool',
  description: 'Simple echo – returns the same string that is passed in.',
  tier: ToolTier.FREE,
  inputSchema: EchoToolInputSchema,
  outputSchema: EchoToolOutputSchema,
  async execute(input) {
    return { echoed: input.message };
  },
};
