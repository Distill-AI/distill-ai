import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageHeaderProvider, usePageHeader } from '../../context/PageHeaderContext';
import { TopBar } from './TopBar';

const DEFAULT_PROPS = {
  isOpen: false,
  menuButtonRef: { current: null },
  onMenuClick: () => {},
};

function renderTopBar(props = DEFAULT_PROPS) {
  return render(
    <MemoryRouter>
      <PageHeaderProvider>
        <TopBar {...props} />
      </PageHeaderProvider>
    </MemoryRouter>,
  );
}

function SetTitle({ title }: { title: string }) {
  const { setTitle } = usePageHeader();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}

function SetActions({ label }: { label: string }) {
  const { setActions } = usePageHeader();
  useEffect(() => {
    setActions(<button type="button">{label}</button>);
    return () => setActions(null);
  }, [label, setActions]);
  return null;
}

function renderTopBarWithContext({ title, actions }: { title?: string; actions?: string } = {}) {
  return render(
    <MemoryRouter>
      <PageHeaderProvider>
        {title && <SetTitle title={title} />}
        {actions && <SetActions label={actions} />}
        <TopBar {...DEFAULT_PROPS} />
      </PageHeaderProvider>
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  it('renders hamburger on mobile viewport', () => {
    renderTopBar();
    expect(screen.getByLabelText('Open navigation')).toBeInTheDocument();
  });

  it('renders the user avatar', () => {
    renderTopBar();
    expect(screen.getByLabelText(/signed in as/i)).toBeInTheDocument();
  });

  it('renders title slot content when context has a title', () => {
    renderTopBarWithContext({ title: 'Inbox' });
    expect(screen.getByText('Inbox')).toBeInTheDocument();
  });

  it('renders actions slot content when context has actions', () => {
    renderTopBarWithContext({ actions: 'New request' });
    expect(screen.getByRole('button', { name: 'New request' })).toBeInTheDocument();
  });

  it('does not render the divider when actions is null', () => {
    renderTopBar();
    expect(screen.queryByTestId('header-divider')).not.toBeInTheDocument();
  });
});
