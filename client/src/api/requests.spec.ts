import { requestKeys, postRequest } from './requests';

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { post: mockPost },
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
