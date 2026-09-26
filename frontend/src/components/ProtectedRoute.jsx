import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loading } from './common';

/** <ProtectedRoute /> = any logged in user. <ProtectedRoute role="admin" /> = admins only. */
export default function ProtectedRoute({ role }) {
  const { user, ready } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
