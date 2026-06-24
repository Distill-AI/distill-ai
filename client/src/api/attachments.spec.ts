import { downloadAttachment } from './attachments';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet },
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
