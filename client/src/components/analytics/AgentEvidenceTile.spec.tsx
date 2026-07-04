import { render, screen } from '@testing-library/react';
import { AgentEvidenceTile } from './AgentEvidenceTile';

describe('AgentEvidenceTile', () => {
  it('renders tool-call count and crash-recovery count', () => {
    render(<AgentEvidenceTile toolCallsTotal={847} crashRecoveries={3} />);
    expect(screen.getByText('Agent evidence')).toBeInTheDocument();
    expect(screen.getByText('847')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
    expect(screen.getByText('Crash recoveries')).toBeInTheDocument();
  });

  it('renders zero correctly when there have been no tool calls (EC-01)', () => {
    render(<AgentEvidenceTile toolCallsTotal={0} crashRecoveries={0} />);
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders a zero resume count when there are tool calls but no recoveries', () => {
    render(<AgentEvidenceTile toolCallsTotal={412} crashRecoveries={0} />);
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(1);
  });

  it('formats large tool-call counts with locale separators', () => {
    render(<AgentEvidenceTile toolCallsTotal={15000} crashRecoveries={1} />);
    expect(screen.getByText('15,000')).toBeInTheDocument();
  });

  it('treats undefined toolCallsTotal as zero', () => {
    render(<AgentEvidenceTile toolCallsTotal={undefined as never} crashRecoveries={0} />);
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
  });

  it('treats NaN toolCallsTotal as zero', () => {
    render(<AgentEvidenceTile toolCallsTotal={NaN} crashRecoveries={0} />);
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
  });
});
