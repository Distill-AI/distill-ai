import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../../context/RoleContext';
import { Sidebar } from './Sidebar';

function renderSidebar(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RoleProvider>
        <Sidebar isOpen={false} onClose={() => {}} />
      </RoleProvider>
    </MemoryRouter>,
  );
}

function inboxLink() {
  return screen.getByRole('link', { name: /inbox/i });
}

function quotesLink() {
  return screen.getByRole('link', { name: /quotes/i });
}

describe('Sidebar active state', () => {
  it('highlights Inbox at /', () => {
    renderSidebar('/');
    expect(inboxLink().className).toContain('shadow-[inset_3px_0_0_#6366F1]');
  });

  it('highlights Inbox at /requests', () => {
    renderSidebar('/requests');
    expect(inboxLink().className).toContain('shadow-[inset_3px_0_0_#6366F1]');
  });

  it('highlights Inbox at /requests/some-id', () => {
    renderSidebar('/requests/some-id');
    expect(inboxLink().className).toContain('shadow-[inset_3px_0_0_#6366F1]');
  });

  it('highlights Inbox at /requests/some-id/review', () => {
    renderSidebar('/requests/some-id/review');
    expect(inboxLink().className).toContain('shadow-[inset_3px_0_0_#6366F1]');
  });

  it('does not highlight Inbox at /quotes', () => {
    renderSidebar('/quotes');
    expect(inboxLink().className).not.toContain('shadow-[inset_3px_0_0_#6366F1]');
  });

  it('highlights Quotes at /quotes', () => {
    renderSidebar('/quotes');
    expect(quotesLink().className).toContain('shadow-[inset_3px_0_0_#6366F1]');
  });
});
