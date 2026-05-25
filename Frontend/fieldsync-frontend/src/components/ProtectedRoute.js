import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ProtectedRoute({ children, requireManager = false }) {
  const { user } = useAuth();

  // ❌ Not logged in
  if (!user) {
    return <Navigate to="/login" />;
  }

  // 🔐 Manager-only routes
  if (requireManager && user?.role !== 'manager' && user?.role !== 'owner') {
    return <Navigate to="/dashboard" />;
  }

  // ✅ Allow access
  return children;
}

export default ProtectedRoute;