import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { Inbox } from './pages/Inbox';
import { Review } from './pages/Review';
import { Quotes } from './pages/Quotes';
import { Catalog } from './pages/Catalog';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { ProcessingRequestPage } from './pages/ProcessingRequestPage';
import { ClarificationView } from './pages/ClarificationView';
import { PasteFallbackDemo } from './pages/PasteFallbackDemo';
import { ProtectedRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <Inbox /> },
      { path: '/requests/:id', element: <ProcessingRequestPage /> },
      { path: '/requests/:id/review', element: <Review /> },
      { path: '/requests/:id/clarification', element: <ClarificationView /> },
      { path: '/quotes', element: <Quotes /> },
      {
        path: '/catalog',
        element: (
          <ProtectedRoute roles={['RevOps', 'Admin']}>
            <Catalog />
          </ProtectedRoute>
        ),
      },
      {
        path: '/analytics',
        element: (
          <ProtectedRoute roles={['RevOps', 'Admin']}>
            <Analytics />
          </ProtectedRoute>
        ),
      },
      { path: '/settings', element: <Settings /> },
      ...(import.meta.env.DEV
        ? [{ path: '/demo/paste-fallback', element: <PasteFallbackDemo /> }]
        : []),
    ],
  },
]);
