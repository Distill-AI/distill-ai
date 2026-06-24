import { requestKeys, postRequest, fetchRequests, buildOptimisticSummary } from './requests';

const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { post: mockPost, get: mockGet },
}));

const stubResponse = { request_id: 'test-uuid', status: 'pending', current_node: 'parse' };

describe('requestKeys', () => {
  it('all() returns the root key', () => {
    expect(requestKeys.all()).toEqual(['requests']);
  });

  it('lists() nests under all()', () => {
    expect(requestKeys.lists()).toEqual(['requests', 'list']);
  });

  it('lists() returns a stable array value on repeated calls', () => {
    expect(requestKeys.lists()).toEqual(requestKeys.lists());
  });

  it('detail() includes the id', () => {
    expect(requestKeys.detail('abc-123')).toEqual(['requests', 'detail', 'abc-123']);
  });
});

describe('postRequest', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('builds FormData with channel=upload and appends each file for kind:file', async () => {
    const file1 = new File(['a'], 'rfq.pdf', { type: 'application/pdf' });
    const file2 = new File(['b'], 'items.csv', { type: 'text/csv' });
    mockPost.mockResolvedValue({ data: { data: stubResponse } });

    await postRequest({ kind: 'file', files: [file1, file2] });

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(url).toBe('/requests');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('channel')).toBe('upload');
    expect(body.getAll('files')).toEqual([file1, file2]);
  });

  it('sends JSON with channel=email and source_body for kind:paste', async () => {
    mockPost.mockResolvedValue({ data: { data: stubResponse } });

    await postRequest({ kind: 'paste', sourceBody: 'Hello world' });

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, body] = mockPost.mock.calls[0] as [string, object];
    expect(url).toBe('/requests');
    expect(body).toEqual({ channel: 'email', source_body: 'Hello world' });
  });

  it('returns the data envelope field from the response', async () => {
    mockPost.mockResolvedValue({ data: { data: stubResponse } });

    const result = await postRequest({ kind: 'paste', sourceBody: 'test' });

    expect(result).toEqual(stubResponse);
  });
});

describe('fetchRequests', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('GETs /requests and unwraps the data envelope', async () => {
    const rows = [{ id: 'a', status: 'parsing' }];
    mockGet.mockResolvedValue({ data: { data: rows } });

    const result = await fetchRequests();

    expect(mockGet).toHaveBeenCalledWith('/requests');
    expect(result).toBe(rows);
  });
});

describe('buildOptimisticSummary', () => {
  const response = { request_id: 'req-1', status: 'parsing', current_node: 'parse' };
  const createdAt = '2026-06-24T10:00:00.000Z';

  it('uses the first file name as the subject for file uploads', () => {
    const file = new File(['x'], 'rfq_apex.pdf', { type: 'application/pdf' });

    const summary = buildOptimisticSummary(response, { kind: 'file', files: [file] }, createdAt);

    expect(summary).toEqual({
      id: 'req-1',
      sender_company: null,
      sender_contact: null,
      source_subject: 'rfq_apex.pdf',
      request_type: 'unknown',
      overall_confidence: null,
      status: 'parsing',
      created_at: createdAt,
    });
  });

  it('truncates a pasted body to 80 chars for the subject', () => {
    const body = 'a'.repeat(120);

    const summary = buildOptimisticSummary(response, { kind: 'paste', sourceBody: body }, createdAt);

    expect(summary.source_subject).toHaveLength(80);
  });

  it('falls back to parsing status when the response omits one', () => {
    const summary = buildOptimisticSummary(
      { request_id: 'req-1', status: '', current_node: 'parse' },
      { kind: 'paste', sourceBody: 'hi' },
      createdAt,
    );

    expect(summary.status).toBe('parsing');
  });
});
