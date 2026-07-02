import { render, screen } from '@testing-library/react';
import { QuoteFunnelChart } from './QuoteFunnelChart';

const fourStage = [
  { label: 'Ingested', value: 410 },
  { label: 'Drafted', value: 372 },
  { label: 'Approved', value: 295 },
  { label: 'Sent', value: 268 },
];

describe('QuoteFunnelChart', () => {
  it('renders a label and value per stage', () => {
    render(<QuoteFunnelChart stages={fourStage} />);
    expect(screen.getByText('Ingested')).toBeInTheDocument();
    expect(screen.getByText('410')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('268')).toBeInTheDocument();
  });

  it('does not overflow when every stage equals the first', () => {
    const stages = [
      { label: 'Ingested', value: 100 },
      { label: 'Drafted', value: 100 },
    ];
    render(<QuoteFunnelChart stages={stages} />);
    expect(screen.getAllByText('100')).toHaveLength(2);
  });

  it('clamps bar width to 100% when a later stage exceeds the first', () => {
    const stages = [
      { label: 'Ingested', value: 100 },
      { label: 'Drafted', value: 150 },
    ];
    const { container } = render(<QuoteFunnelChart stages={stages} />);
    const bars = container.querySelectorAll<HTMLElement>('.bg-indigo-600');
    expect(bars[1].style.width).toBe('100%');
  });

  it('clamps a negative stage value to 0% instead of a negative width', () => {
    const stages = [
      { label: 'Ingested', value: 100 },
      { label: 'Drafted', value: -10 },
    ];
    const { container } = render(<QuoteFunnelChart stages={stages} />);
    const bars = container.querySelectorAll<HTMLElement>('.bg-indigo-600');
    expect(bars[1].style.width).toBe('0%');
  });

  it('treats a non-finite stage value as 0% instead of emitting NaN', () => {
    const stages = [
      { label: 'Ingested', value: 100 },
      { label: 'Drafted', value: NaN },
    ];
    const { container } = render(<QuoteFunnelChart stages={stages} />);
    const bars = container.querySelectorAll<HTMLElement>('.bg-indigo-600');
    expect(bars[1].style.width).toBe('0%');
  });

  it('renders an empty-state message for an empty stage list', () => {
    render(<QuoteFunnelChart stages={[]} />);
    expect(screen.getByText('No quotes processed in this period')).toBeInTheDocument();
  });

  it('renders an empty-state message when the first stage is zero', () => {
    render(<QuoteFunnelChart stages={[{ label: 'Ingested', value: 0 }]} />);
    expect(screen.getByText('No quotes processed in this period')).toBeInTheDocument();
  });
});
