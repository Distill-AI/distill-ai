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
    expect(inboxLink()).toHaveAttribute('aria-current', 'page');
  });

  it('highlights Inbox at /requests', () => {
    renderSidebar('/requests');
    expect(inboxLink()).toHaveAttribute('aria-current', 'page');
  });

  it('highlights Inbox at /requests/some-id', () => {
    renderSidebar('/requests/some-id');
    expect(inboxLink()).toHaveAttribute('aria-current', 'page');
  });

  it('highlights Inbox at /requests/some-id/review', () => {
    renderSidebar('/requests/some-id/review');
    expect(inboxLink()).toHaveAttribute('aria-current', 'page');
  });

  it('highlights Inbox at /requests/', () => {
    renderSidebar('/requests/');
    expect(inboxLink()).toHaveAttribute('aria-current', 'page');
  });

  it('does not highlight Inbox at /quotes', () => {
    renderSidebar('/quotes');
    expect(inboxLink()).not.toHaveAttribute('aria-current', 'page');
  });

  it('does not highlight Inbox at /quotes/some-id', () => {
    renderSidebar('/quotes/some-id');
    expect(inboxLink()).not.toHaveAttribute('aria-current', 'page');
  });

  it('highlights Quotes at /quotes', () => {
    renderSidebar('/quotes');
    expect(quotesLink()).toHaveAttribute('aria-current', 'page');
  });
});
