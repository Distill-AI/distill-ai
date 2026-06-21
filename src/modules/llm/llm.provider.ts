import { Injectable } from '@nestjs/common';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';

export interface LLMInvokeParams {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMInvokeResponse {
  text: string;
}

@Injectable()
export class LLMProvider {
  async invoke(params: LLMInvokeParams): Promise<LLMInvokeResponse> {
    const { prompt, temperature = 0.2, maxTokens = 100 } = params;

    const response = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(SYS_MSG.LLM_INVOCATION_FAILED(response.status, body));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    return { text };
  }
}
