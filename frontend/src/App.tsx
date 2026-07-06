import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CheckIn from './pages/CheckIn';
import Dashboard from './pages/Dashboard';
import WaitingScreen from './pages/WaitingScreen';
import DockManagement from './pages/DockManagement';
import Backoffice from './pages/Backoffice';
import Track from './pages/Track';
import ReceivingTimes from './pages/ReceivingTimes';
import Reports from './pages/Reports';
import Navbar from './components/Navbar';

function homePathForRole(role?: string) {
  if (role === 'CHECKIN') return '/check-in';
  return '/dashboard';
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to={homePathForRole(user?.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Pages that have their own full-screen layout — hide the global nav
  const isPublicFullscreen = ['/waiting-screen', '/track'].some(
    (p) => location.pathname.startsWith(p),
  );

  return (
    <div className="min-h-screen">
      {isAuthenticated && !isPublicFullscreen && <Navbar />}
      {/* Offset content: sidebar width on desktop, top bar height on mobile */}
      <div className={isAuthenticated && !isPublicFullscreen ? 'md:pl-56 pt-14 md:pt-0' : ''}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/waiting-screen" element={<WaitingScreen />} />
        <Route path="/taixe" element={<Navigate to="/register" replace />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:code" element={<Track />} />
        <Route
          path="/check-in"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN']}>
              <CheckIn />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docks"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}>
              <DockManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backoffice"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE']}>
              <Backoffice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receiving-times"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}>
              <ReceivingTimes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? homePathForRole(user?.role) : '/register'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </div>
  );
}
