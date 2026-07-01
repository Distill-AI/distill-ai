import {
  clarificationKeys,
  fetchClarification,
  generateClarificationDraft,
  updateClarificationDraft,
  sendClarification,
} from './clarification';

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut },
}));

const stubClarification = {
  id: 'clar-1',
  request_id: 'req-1',
  gaps: ['invoice.pdf: This file contains only scanned images with no readable text.'],
  draft_subject: 'Quick questions on your request',
  draft_body: 'Hi there, could you resend invoice.pdf as a searchable PDF?',
  sent_at: null,
};

describe('clarificationKeys', () => {
  it('all() returns the root key', () => {
    expect(clarificationKeys.all()).toEqual(['clarifications']);
  });

  it('byRequest() nests under all() with the request id', () => {
    expect(clarificationKeys.byRequest('req-1')).toEqual(['clarifications', 'request', 'req-1']);
  });
});

describe('fetchClarification', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches from the request-scoped clarifications endpoint', async () => {
    mockGet.mockResolvedValue({ data: { data: stubClarification } });

    const result = await fetchClarification('req-1');

    expect(mockGet).toHaveBeenCalledWith('/requests/req-1/clarifications');
    expect(result).toEqual(stubClarification);
  });
});

describe('generateClarificationDraft', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts gaps to the draft endpoint', async () => {
    mockPost.mockResolvedValue({ data: { data: stubClarification } });

    const result = await generateClarificationDraft({ requestId: 'req-1', gaps: ['a gap'] });

    expect(mockPost).toHaveBeenCalledWith('/requests/req-1/clarifications/draft', {
      gaps: ['a gap'],
    });
    expect(result).toEqual(stubClarification);
  });
});

describe('updateClarificationDraft', () => {
  beforeEach(() => {
    mockPut.mockReset();
  });

  it('puts the subject/body edits to the clarification-scoped endpoint', async () => {
    mockPut.mockResolvedValue({ data: { data: stubClarification } });

    const result = await updateClarificationDraft({
      id: 'clar-1',
      draft_subject: 'New subject',
      draft_body: 'New body',
    });

    expect(mockPut).toHaveBeenCalledWith('/clarifications/clar-1/draft', {
      draft_subject: 'New subject',
      draft_body: 'New body',
    });
    expect(result).toEqual(stubClarification);
  });
});

describe('sendClarification', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts to the send endpoint with no body', async () => {
    mockPost.mockResolvedValue({
      data: { data: { ...stubClarification, sent_at: '2026-07-01T00:00:00.000Z' } },
    });

    const result = await sendClarification('clar-1');

    expect(mockPost).toHaveBeenCalledWith('/clarifications/clar-1/send');
    expect(result.sent_at).toBe('2026-07-01T00:00:00.000Z');
  });
});
