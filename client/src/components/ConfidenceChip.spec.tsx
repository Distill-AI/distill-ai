import { render, screen } from '@testing-library/react';
import { ConfidenceChip } from './ConfidenceChip';
import type { ConfidenceThresholds } from '../config/thresholds';

describe('ConfidenceChip', () => {
  // AC-01: A 0.98 line shows a green chip at 98%
  it('renders green chip at 98% for value 0.98', () => {
    render(<ConfidenceChip value={0.98} />);
    expect(screen.getByText('98%')).toBeInTheDocument();
    const chip = screen.getByText('98%').parentElement!;
    expect(chip.className).toContain('bg-hi-bg');
    expect(chip.className).toContain('text-hi-tx');
  });

  // AC-02: A 0.64 line shows a red chip at 64% with a needs-review marker
  it('renders red chip at 64% with Review marker for value 0.64', () => {
    render(<ConfidenceChip value={0.64} />);
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    const chip = screen.getByText('64%').parentElement!;
    expect(chip.className).toContain('bg-lo-bg');
    expect(chip.className).toContain('text-lo-tx');
  });

  // Amber band
  it('renders amber chip for mid-range confidence (0.82)', () => {
    render(<ConfidenceChip value={0.82} />);
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
    const chip = screen.getByText('82%').parentElement!;
    expect(chip.className).toContain('bg-md-bg');
    expect(chip.className).toContain('text-md-tx');
  });

  // EC-01: null confidence -> neutral no-data chip
  it('renders neutral no-data chip when value is null', () => {
    render(<ConfidenceChip value={null} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    const chip = screen.getByText('No data');
    expect(chip.className).toContain('bg-canvas');
    expect(chip.className).toContain('text-muted');
  });

  it('renders neutral no-data chip when value is undefined', () => {
    render(<ConfidenceChip value={undefined as unknown as null} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  // EC-02: boundary values — inclusive rules
  it('treats exactly autoThreshold (0.95) as green', () => {
    render(<ConfidenceChip value={0.95} />);
    const chip = screen.getByText('95%').parentElement!;
    expect(chip.className).toContain('bg-hi-bg');
  });

  it('treats exactly matchThreshold (0.70) as amber', () => {
    render(<ConfidenceChip value={0.7} />);
    const chip = screen.getByText('70%').parentElement!;
    expect(chip.className).toContain('bg-md-bg');
  });

  it('treats just below matchThreshold (0.69) as red', () => {
    render(<ConfidenceChip value={0.69} />);
    const chip = screen.getByText('69%').parentElement!;
    expect(chip.className).toContain('bg-lo-bg');
  });

  // AC-03: chip colour recomputes when thresholds change
  it('uses custom thresholds and recomputes colour', () => {
    const customThresholds: ConfidenceThresholds = {
      autoThreshold: 0.8,
      matchThreshold: 0.5,
    };
    render(<ConfidenceChip value={0.75} thresholds={customThresholds} />);
    const chip = screen.getByText('75%').parentElement!;
    expect(chip.className).toContain('bg-md-bg');
  });

  it('renders green when value meets lower custom autoThreshold', () => {
    const customThresholds: ConfidenceThresholds = {
      autoThreshold: 0.8,
      matchThreshold: 0.5,
    };
    render(<ConfidenceChip value={0.85} thresholds={customThresholds} />);
    const chip = screen.getByText('85%').parentElement!;
    expect(chip.className).toContain('bg-hi-bg');
  });

  it('renders red when value falls below custom matchThreshold', () => {
    const customThresholds: ConfidenceThresholds = {
      autoThreshold: 0.9,
      matchThreshold: 0.6,
    };
    render(<ConfidenceChip value={0.45} thresholds={customThresholds} />);
    const chip = screen.getByText('45%').parentElement!;
    expect(chip.className).toContain('bg-lo-bg');
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  // skuLabel rendering
  it('renders skuLabel when provided', () => {
    render(<ConfidenceChip value={0.95} skuLabel="BOLT-M12" />);
    expect(screen.getByText('BOLT-M12')).toBeInTheDocument();
  });

  it('renders skuLabel on null confidence instead of No data', () => {
    render(<ConfidenceChip value={null} skuLabel="SKU-001" />);
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });
});
