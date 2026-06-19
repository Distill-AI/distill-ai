import { Routes, Route } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { AppShell } from './components/shell/AppShell';
import { Inbox } from './pages/Inbox';
import { Quotes } from './pages/Quotes';
import { Catalog } from './pages/Catalog';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <RoleProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
    </RoleProvider>
  );
}
