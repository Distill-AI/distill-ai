import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { CircuitBreakerOpenError } from '@modules/pipeline/pipeline.errors';
import * as SYS_MSG from '@constants/system-messages';
import { DraftClarificationToolFactory } from '../tools/draft-clarification.tool';

const INPUT = {
  gaps: ['Missing delivery date', 'No contact name'],
  requestId: '11111111-1111-4111-8111-111111111111',
};

function makeCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

function setup() {
  const llm = { createChatCompletion: vi.fn() };
  const factory = new DraftClarificationToolFactory(llm as never);
  return { factory, llm };
}

describe('DraftClarificationToolFactory', () => {
  it('parses a clean JSON response', async () => {
    const { factory, llm } = setup();
    llm.createChatCompletion.mockResolvedValue(
      makeCompletion(
        JSON.stringify({ draft_subject: 'Missing info', draft_body: 'Please provide...' }),
      ),
    );
    const contract = factory.create();

    const result = await contract.execute(INPUT);

    expect(result).toEqual({ draft_subject: 'Missing info', draft_body: 'Please provide...' });
  });

  it('strips a markdown code fence before parsing', async () => {
    const { factory, llm } = setup();
    llm.createChatCompletion.mockResolvedValue(
      makeCompletion(
        '```json\n{"draft_subject": "Missing info", "draft_body": "Please provide..."}\n```',
      ),
    );
    const contract = factory.create();

    const result = await contract.execute(INPUT);

    expect(result).toEqual({ draft_subject: 'Missing info', draft_body: 'Please provide...' });
  });

  it('throws CLARIFICATION_DRAFT_PARSE_FAILED when the response is not valid JSON', async () => {
    const { factory, llm } = setup();
    llm.createChatCompletion.mockResolvedValue(makeCompletion('not json at all'));
    const contract = factory.create();

    await expect(contract.execute(INPUT)).rejects.toEqual(
      new CustomHttpException(
        SYS_MSG.CLARIFICATION_DRAFT_PARSE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
  });

  it('throws CLARIFICATION_DRAFT_PARSE_FAILED when the JSON does not match the output schema', async () => {
    const { factory, llm } = setup();
    llm.createChatCompletion.mockResolvedValue(
      makeCompletion(JSON.stringify({ draft_subject: 'Missing info' })),
    );
    const contract = factory.create();

    await expect(contract.execute(INPUT)).rejects.toEqual(
      new CustomHttpException(
        SYS_MSG.CLARIFICATION_DRAFT_PARSE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
  });

  it('propagates CircuitBreakerOpenError uncaught instead of a parse-failure exception', async () => {
    const { factory, llm } = setup();
    llm.createChatCompletion.mockRejectedValue(new CircuitBreakerOpenError());
    const contract = factory.create();

    await expect(contract.execute(INPUT)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });
});
