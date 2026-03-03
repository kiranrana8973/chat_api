import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminConversations from './pages/admin/AdminConversations';
import AdminMessages from './pages/admin/AdminMessages';
import ChatPage from './pages/chat/ChatPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/chat" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to={isAdmin ? '/admin' : '/chat'} /> : <Login />} />
      <Route path="/register" element={token ? <Navigate to="/chat" /> : <Register />} />

      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="conversations" element={<AdminConversations />} />
        <Route path="conversations/:id" element={<AdminMessages />} />
      </Route>

      <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />

      <Route path="*" element={<Navigate to={token ? (isAdmin ? '/admin' : '/chat') : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
