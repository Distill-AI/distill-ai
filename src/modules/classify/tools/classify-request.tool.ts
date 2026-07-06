import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ToolContract,
  ToolCallContext,
} from '@modules/tools/interfaces/tool-contract.interface';
import { ClassifyService } from '../services/classify.service';

const ClassifyRequestInputSchema = z.object({
  company: z.string(),
  contact: z.string(),
  description: z.string(),
  lineItems: z
    .array(
      z.object({
        raw_text: z.string(),
        position: z.number().int(),
        quantity: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

const ClassifyRequestOutputSchema = z.object({
  type: z.enum(['catalog_rfq', 'service_quote']),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class ClassifyRequestToolFactory {
  constructor(private readonly classifyService: ClassifyService) {}

  create(): ToolContract<typeof ClassifyRequestInputSchema, typeof ClassifyRequestOutputSchema> {
    return {
      toolName: 'classify_request',
      description: 'Classify an inbound B2B request as catalog_rfq or service_quote.',
      inputSchema: ClassifyRequestInputSchema,
      outputSchema: ClassifyRequestOutputSchema,
      execute: async (input, context?: ToolCallContext) =>
        this.classifyService.classify(
          {
            company: input.company,
            contact: input.contact,
            description: input.description,
            lineItems: input.lineItems,
          },
          { orgId: context?.orgId ?? '', requestId: context?.requestId ?? '' },
        ),
    };
  }
}
