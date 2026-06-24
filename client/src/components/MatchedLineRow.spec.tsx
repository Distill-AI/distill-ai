import { render, screen } from '@testing-library/react';
import { MatchedLineRow } from './MatchedLineRow';
import type { MatchedLine } from '../api/interface/line-item';

describe('MatchedLineRow', () => {
  const greenLine: MatchedLine = {
    position: 1,
    rawText: 'M12 Stainless Steel Bolt x 50',
    skuLabel: 'BOLT-M12',
    confidence: 0.98,
  };

  const redLine: MatchedLine = {
    position: 2,
    rawText: 'Custom widget assembly',
    skuLabel: null,
    confidence: 0.64,
  };

  const unmatchedLine: MatchedLine = {
    position: 3,
    rawText: 'Miscellaneous hardware',
    skuLabel: null,
    confidence: null,
  };

  it('renders position, rawText, skuLabel and confidence chip for green line', () => {
    render(<MatchedLineRow line={greenLine} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('M12 Stainless Steel Bolt x 50')).toBeInTheDocument();
    expect(screen.getByText('BOLT-M12')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
  });

  it('renders red line with needs-review marker', () => {
    render(<MatchedLineRow line={redLine} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Custom widget assembly')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders null-confidence line with neutral chip', () => {
    render(<MatchedLineRow line={unmatchedLine} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Miscellaneous hardware')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders skuLabel confidence chip when skuLabel is null', () => {
    render(<MatchedLineRow line={redLine} />);
    expect(screen.getByText('64%')).toBeInTheDocument();
  });

  it('accepts custom thresholds', () => {
    const line: MatchedLine = {
      position: 4,
      rawText: 'Premium bolt set',
      skuLabel: 'BOLT-PREMIUM',
      confidence: 0.75,
    };
    render(<MatchedLineRow line={line} thresholds={{ autoThreshold: 0.8, matchThreshold: 0.6 }} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    const chip = screen.getByText('75%').parentElement!;
    expect(chip.className).toContain('bg-md-bg');
  });

  // SEC-01: React auto-escapes user-supplied text
  it('escapes rawText to prevent XSS', () => {
    const xssLine: MatchedLine = {
      position: 1,
      rawText: '<script>alert("xss")</script>',
      skuLabel: null,
      confidence: 0.9,
    };
    const { container } = render(<MatchedLineRow line={xssLine} />);
    expect(container.innerHTML).not.toContain('<script>alert("xss")</script>');
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });
});
