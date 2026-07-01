import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from './App';

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<App />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    localStorage.removeItem('distill.role');
  });

  it('renders the sidebar with brand lockup and nav links', () => {
    renderApp();

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getAllByText(/distill/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quotes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('hides catalog and analytics links for the Sales role', () => {
    localStorage.setItem('distill.role', 'Sales');

    renderApp();

    expect(screen.queryByRole('link', { name: /catalog/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /analytics/i })).not.toBeInTheDocument();
  });
});
