import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import * as SYS_MSG from '@constants/system-messages';
import { DraftQuoteEmailToolFactory } from '../tools/draft-quote-email.tool';

const INPUT = {
  quoteNumber: 'Q-001',
  totalMinor: 150000,
  currency: 'GBP',
  leadTimeDays: 5,
  senderContact: 'Jane',
  senderCompany: 'Acme',
};

function setup() {
  const llm = { invoke: vi.fn() };
  const factory = new DraftQuoteEmailToolFactory(llm as never);
  return { factory, llm };
}

describe('DraftQuoteEmailToolFactory', () => {
  it('parses a clean JSON response', async () => {
    const { factory, llm } = setup();
    llm.invoke.mockResolvedValue({
      text: JSON.stringify({ draft_subject: 'Quote Q-001', draft_body: 'Hello Jane' }),
    });
    const contract = factory.create();

    const result = await contract.execute(INPUT);

    expect(result).toEqual({ draft_subject: 'Quote Q-001', draft_body: 'Hello Jane' });
  });

  it('strips a markdown code fence before parsing', async () => {
    const { factory, llm } = setup();
    llm.invoke.mockResolvedValue({
      text: '```json\n{"draft_subject": "Quote Q-001", "draft_body": "Hello Jane"}\n```',
    });
    const contract = factory.create();

    const result = await contract.execute(INPUT);

    expect(result).toEqual({ draft_subject: 'Quote Q-001', draft_body: 'Hello Jane' });
  });

  it('throws QUOTE_EMAIL_DRAFT_PARSE_FAILED when the response is not valid JSON', async () => {
    const { factory, llm } = setup();
    llm.invoke.mockResolvedValue({ text: 'not json at all' });
    const contract = factory.create();

    await expect(contract.execute(INPUT)).rejects.toEqual(
      new CustomHttpException(
        SYS_MSG.QUOTE_EMAIL_DRAFT_PARSE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
  });

  it('throws QUOTE_EMAIL_DRAFT_PARSE_FAILED when the JSON does not match the output schema', async () => {
    const { factory, llm } = setup();
    llm.invoke.mockResolvedValue({ text: JSON.stringify({ draft_subject: 'Quote Q-001' }) });
    const contract = factory.create();

    await expect(contract.execute(INPUT)).rejects.toEqual(
      new CustomHttpException(
        SYS_MSG.QUOTE_EMAIL_DRAFT_PARSE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
  });
});
