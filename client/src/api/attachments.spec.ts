import { downloadAttachment, attachmentKeys, pasteAttachment } from './attachments';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost },
}));

describe('downloadAttachment', () => {
  beforeEach(() => {
    mockGet.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
  });

  it('fetches the attachment as a blob and saves it under its filename', async () => {
    const blob = new Blob(['PDF-BYTES'], { type: 'application/pdf' });
    mockGet.mockResolvedValue({ data: blob });

    let downloadName = '';
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadName = this.download;
    });

    await downloadAttachment('req-1', 'att-1', 'rfq_apex.pdf');

    expect(mockGet).toHaveBeenCalledWith('/requests/req-1/attachments/att-1', {
      responseType: 'blob',
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadName).toBe('rfq_apex.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

    clickSpy.mockRestore();
  });

  it('propagates the error when the request fails', async () => {
    mockGet.mockRejectedValue(new Error('network'));

    await expect(downloadAttachment('req-1', 'att-1', 'rfq.pdf')).rejects.toThrow('network');
  });
});

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
