import { Outlet } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { UserProvider } from './context/UserContext';
import { AppShell } from './components/shell/AppShell';

export default function App() {
  return (
    <UserProvider>
      <RoleProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </RoleProvider>
    </UserProvider>
  );
}
