import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';

//Sends signed-out users to /login. This only improves navigation; the server's
//requireAuth / requireRole middleware is what actually protects data.
//  <Route path="/labs/:id" element={<RequireAuth><LabPage /></RequireAuth>} />
//  <Route path="/labs/new" element={<RequireAuth role="manager"><NewLab /></RequireAuth>} />
export function RequireAuth({ role, children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === AUTH_STATUS.LOADING) {
    return <p className="text-gray-500">Loading…</p>;
  }
  if (status === AUTH_STATUS.SIGNED_OUT) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
