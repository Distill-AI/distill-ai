import { attachmentKeys, pasteAttachment } from './attachments';

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { post: mockPost },
}));

describe('attachmentKeys', () => {
  it('paste() includes requestId and attachmentId', () => {
    expect(attachmentKeys.paste('req-1', 'att-1')).toEqual([
      'attachments',
      'req-1',
      'att-1',
      'paste',
    ]);
  });
});

describe('pasteAttachment', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts to the correct URL with content in the body', async () => {
    mockPost.mockResolvedValue({
      data: { data: { message: 'Content accepted; extraction re-queued' } },
    });

    await pasteAttachment('req-1', 'att-1', { content: 'line items here' });

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, body] = mockPost.mock.calls[0] as [string, object];
    expect(url).toBe('/requests/req-1/attachments/att-1/paste');
    expect(body).toEqual({ content: 'line items here' });
  });

  it('returns the unwrapped data envelope', async () => {
    const stubResponse = { message: 'Content accepted; extraction re-queued' };
    mockPost.mockResolvedValue({ data: { data: stubResponse } });

    const result = await pasteAttachment('req-1', 'att-1', { content: 'text' });

    expect(result).toEqual(stubResponse);
  });
});
