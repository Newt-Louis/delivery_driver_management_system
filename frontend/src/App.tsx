import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterManual from './pages/RegisterManual';
import CheckIn from './pages/CheckIn';
import Dashboard from './pages/Dashboard';
import WaitingScreen from './pages/WaitingScreen';
import DockManagement from './pages/DockManagement';
import Backoffice from './pages/Backoffice';
import Superadmin from './pages/Superadmin';
import Track from './pages/Track';
import ReceivingTimes from './pages/ReceivingTimes';
import Reports from './pages/Reports';
import Histories from './pages/Histories';
import StaffShell from './components/layout/StaffShell';
import PublicShell from './components/layout/PublicShell';
import SuperadminOperationalContextGate from './components/SuperadminOperationalContextGate';
import ToastContainer from './components/ToastContainer';

function homePathForRole(role?: string) {
  return role === 'CHECKIN' ? '/check-in' : '/dashboard';
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to={homePathForRole(user?.role)} replace />;
  return <>{children}</>;
}

function isStaffRoute(pathname: string) {
  return [
    '/check-in', '/dashboard', '/docks', '/superadmin', '/backoffice',
    '/receiving-times', '/reports', '/histories',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicDriverRoute(pathname: string) {
  return pathname === '/'
    || pathname === '/register'
    || pathname === '/register-manual'
    || pathname === '/track'
    || pathname.startsWith('/track/')
    || pathname === '/waiting-screen';
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const staffRoute = isStaffRoute(location.pathname);
  const publicDriverRoute = isPublicDriverRoute(location.pathname);

  const routes = (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-manual" element={<RegisterManual />} />
      <Route path="/waiting-screen" element={<WaitingScreen />} />
      <Route path="/taixe" element={<Navigate to="/register" replace />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:code" element={<Track />} />
      <Route path="/check-in" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN']}><CheckIn /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}><Dashboard /></ProtectedRoute>} />
      <Route path="/docks" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}><DockManagement /></ProtectedRoute>} />
      <Route path="/superadmin" element={<ProtectedRoute roles={['SUPERADMIN']}><Superadmin /></ProtectedRoute>} />
      <Route path="/backoffice" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC']}><Backoffice /></ProtectedRoute>} />
      <Route path="/receiving-times" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING']}><ReceivingTimes /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE']}><Reports /></ProtectedRoute>} />
      <Route path="/histories" element={<ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE']}><Histories /></ProtectedRoute>} />
      <Route path="/" element={isLoading ? null : <Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <div className="min-h-screen">
      {isAuthenticated && staffRoute ? <StaffShell>{routes}</StaffShell> : publicDriverRoute ? <PublicShell>{routes}</PublicShell> : routes}
      {isAuthenticated && staffRoute && <SuperadminOperationalContextGate />}
      <ToastContainer />
    </div>
  );
}
