import { Routes, Route } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { AppShell } from './components/shell/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Inbox } from './pages/Inbox';
import { Quotes } from './pages/Quotes';
import { Catalog } from './pages/Catalog';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { ProcessingRequestPage } from './pages/ProcessingRequestPage';
import { PasteFallbackDemo } from './pages/PasteFallbackDemo';

export default function App() {
  return (
    <RoleProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/requests/:id" element={<ProcessingRequestPage />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute roles={['RevOps', 'Admin']}>
                <Catalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute roles={['RevOps', 'Admin']}>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route path="/settings" element={<Settings />} />
          {import.meta.env.DEV && (
            <Route path="/demo/paste-fallback" element={<PasteFallbackDemo />} />
          )}
        </Routes>
      </AppShell>
    </RoleProvider>
  );
}
